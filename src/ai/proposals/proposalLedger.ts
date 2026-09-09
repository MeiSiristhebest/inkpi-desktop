import type { TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import {
  proposalStateEvents,
  type ProposalEventScope,
  type ProposalStateEventKind,
} from '../../ports/proposalStateEvents'
import { requirePatchResult, requireTextResult } from '../results/taskResults'
import type { DomainProposalEvidence } from './domainProposal'

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'stale' | 'committed' | 'undone'

export interface TextPatch {
  documentId: string
  from: number
  to: number
  text: string
}

export interface AiProposal {
  id: string
  taskId: string
  documentId: string
  baseRevision: number
  patches: TextPatch[]
  explanation?: string
  status: ProposalStatus
  createdAt: number
  updatedAt?: number
  sourceHash?: string
  inversePatches?: TextPatch[]
  committedRevision?: number
}

export type Evidence = DomainProposalEvidence

export interface CommitReceipt {
  proposalId: string
  documentId: string
  revision: number
  patches: TextPatch[]
  inversePatches?: TextPatch[]
}

type CommitApplyResult = void | { inversePatches?: TextPatch[] }

export interface ProposalStore {
  list(): Promise<AiProposal[]>
  save(proposal: AiProposal): Promise<void>
}

export interface ProposalLedgerOptions {
  now?: () => number
  store?: ProposalStore
  eventScope?: ProposalEventScope
}

export class ProposalConflictError extends Error {
  constructor(proposalId: string, expected: number, actual: number) {
    super(`Proposal ${proposalId} is stale: expected revision ${expected}, received ${actual}`)
    this.name = 'ProposalConflictError'
  }
}

export class ProposalLedger {
  private readonly proposals = new Map<string, AiProposal>()
  private readonly committing = new Set<string>()
  private readonly now: () => number
  private readonly store?: ProposalStore
  private readonly eventScope?: ProposalEventScope
  private persistenceTail: Promise<void> = Promise.resolve()
  private reloadTail: Promise<void> = Promise.resolve()
  readonly ready: Promise<void>

  constructor(options: ProposalLedgerOptions = {}) {
    this.now = options.now ?? Date.now
    this.store = options.store
    this.eventScope = options.eventScope
    this.ready = this.store
      ? this.store.list().then((proposals) => {
          for (const proposal of proposals) {
            validateProposal(proposal)
            if (!this.proposals.has(proposal.id)) this.proposals.set(proposal.id, cloneProposal(proposal))
          }
        })
      : Promise.resolve()
    void this.ready.catch(() => undefined)
  }

  async flush(): Promise<void> {
    await this.ready
    await this.persistenceTail
  }

  /** Reload the authoritative proposal store after a cross-context event. */
  reload(): Promise<void> {
    const operation = this.reloadTail
      .catch(() => undefined)
      .then(async () => {
        await this.ready
        if (!this.store) return
        await this.persistenceTail.catch(() => undefined)

        const proposals = await this.store.list()
        const next = new Map<string, AiProposal>()
        for (const proposal of proposals) {
          validateProposal(proposal)
          next.set(proposal.id, cloneProposal(proposal))
        }

        this.proposals.clear()
        for (const [proposalId, proposal] of next) this.proposals.set(proposalId, proposal)
      })
    this.reloadTail = operation
    return operation
  }

  create(proposal: AiProposal): AiProposal {
    if (this.proposals.has(proposal.id)) throw new Error(`Proposal already exists: ${proposal.id}`)
    validateProposal(proposal)
    const stored = cloneProposal(proposal)
    this.proposals.set(stored.id, stored)
    this.persist(stored, 'created')
    return cloneProposal(stored)
  }

  get(proposalId: string): AiProposal | undefined {
    const proposal = this.proposals.get(proposalId)
    return proposal ? cloneProposal(proposal) : undefined
  }

  list(documentId?: string): AiProposal[] {
    return [...this.proposals.values()]
      .filter((proposal) => !documentId || proposal.documentId === documentId)
      .map(cloneProposal)
  }

  accept(proposalId: string): AiProposal {
    const proposal = this.require(proposalId)
    if (proposal.status !== 'pending') throw new Error(`Proposal ${proposalId} is not pending`)
    proposal.status = 'accepted'
    proposal.updatedAt = this.now()
    this.persist(proposal)
    return cloneProposal(proposal)
  }

  reject(proposalId: string): AiProposal {
    const proposal = this.require(proposalId)
    if (proposal.status !== 'pending') throw new Error(`Proposal ${proposalId} is not pending`)
    proposal.status = 'rejected'
    proposal.updatedAt = this.now()
    this.persist(proposal)
    return cloneProposal(proposal)
  }

  modify(
    proposalId: string,
    change: { patches?: TextPatch[]; explanation?: string; baseRevision?: number; sourceHash?: string },
  ): AiProposal {
    const proposal = this.require(proposalId)
    if (proposal.status === 'committed' || proposal.status === 'undone') {
      throw new Error(`Proposal ${proposalId} cannot be modified after ${proposal.status}`)
    }
    if (change.patches) {
      if (change.patches.length === 0) throw new Error('Proposal requires at least one patch')
      proposal.patches = change.patches.map((patch) => ({ ...patch }))
      validatePatches(proposal.patches, proposal.documentId)
    }
    if (change.sourceHash !== undefined) proposal.sourceHash = change.sourceHash
    if (change.explanation !== undefined) proposal.explanation = change.explanation
    if (change.baseRevision !== undefined) {
      if (!Number.isInteger(change.baseRevision) || change.baseRevision < 0) {
        throw new Error('Proposal base revision must be a non-negative integer')
      }
      proposal.baseRevision = change.baseRevision
    }
    proposal.status = 'pending'
    proposal.updatedAt = this.now()
    this.persist(proposal)
    return cloneProposal(proposal)
  }

  rebase(
    proposalId: string,
    currentRevision: number,
    transform: (patches: TextPatch[]) => TextPatch[] = (patches) => patches,
    currentSourceHash?: string,
  ): AiProposal {
    const proposal = this.require(proposalId)
    if (proposal.status !== 'stale' && proposal.status !== 'pending' && proposal.status !== 'accepted') {
      throw new Error(`Proposal ${proposalId} cannot be rebased from ${proposal.status}`)
    }
    if (!Number.isInteger(currentRevision) || currentRevision < 0) throw new Error('Invalid rebase revision')
    const patches = transform(proposal.patches.map((patch) => ({ ...patch })))
    validatePatches(patches, proposal.documentId)
    proposal.patches = patches.map((patch) => ({ ...patch }))
    proposal.baseRevision = currentRevision
    proposal.sourceHash = currentSourceHash
    proposal.status = 'pending'
    proposal.updatedAt = this.now()
    this.persist(proposal)
    return cloneProposal(proposal)
  }

  async commit(
    proposalId: string,
    currentRevision: number,
    apply: (patches: TextPatch[], nextRevision: number) => CommitApplyResult | Promise<CommitApplyResult>,
    currentSourceHash?: string,
  ): Promise<CommitReceipt> {
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId)) throw new Error(`Proposal ${proposalId} is already being committed`)
    if (proposal.status !== 'accepted') throw new Error(`Proposal ${proposalId} must be accepted before commit`)
    if (currentRevision !== proposal.baseRevision) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistAndWait(proposal, 'conflict')
      throw new ProposalConflictError(proposal.id, proposal.baseRevision, currentRevision)
    }
    if (currentSourceHash !== undefined && proposal.sourceHash !== undefined && currentSourceHash !== proposal.sourceHash) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistAndWait(proposal, 'conflict')
      throw new Error(`Proposal ${proposal.id} source hash does not match the current document`)
    }
    const nextRevision = currentRevision + 1
    this.committing.add(proposalId)
    let applyResult: CommitApplyResult
    try {
      applyResult = await apply(proposal.patches.map((patch) => ({ ...patch })), nextRevision)
    } finally {
      this.committing.delete(proposalId)
    }
    proposal.inversePatches = applyResult && 'inversePatches' in applyResult
      ? applyResult.inversePatches?.map((patch) => ({ ...patch }))
      : proposal.inversePatches
    proposal.status = 'committed'
    proposal.committedRevision = nextRevision
    proposal.updatedAt = this.now()
    await this.persistAndWait(proposal)
    return {
      proposalId: proposal.id,
      documentId: proposal.documentId,
      revision: nextRevision,
      patches: proposal.patches.map((patch) => ({ ...patch })),
      inversePatches: proposal.inversePatches?.map((patch) => ({ ...patch })),
    }
  }

  async undo(
    proposalId: string,
    currentRevision: number,
    apply: (patches: TextPatch[], nextRevision: number) => void | Promise<void>,
  ): Promise<CommitReceipt> {
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId)) throw new Error(`Proposal ${proposalId} is already being committed`)
    if (proposal.status !== 'committed') throw new Error(`Proposal ${proposalId} is not committed`)
    if (!proposal.inversePatches?.length) throw new Error(`Proposal ${proposalId} has no inverse patches`)
    if (currentRevision !== proposal.committedRevision) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistAndWait(proposal, 'conflict')
      throw new ProposalConflictError(proposal.id, proposal.committedRevision ?? currentRevision, currentRevision)
    }
    const nextRevision = currentRevision + 1
    this.committing.add(proposalId)
    try {
      await apply(proposal.inversePatches.map((patch) => ({ ...patch })), nextRevision)
      proposal.status = 'undone'
      proposal.updatedAt = this.now()
      await this.persistAndWait(proposal)
      return {
        proposalId: proposal.id,
        documentId: proposal.documentId,
        revision: nextRevision,
        patches: proposal.inversePatches.map((patch) => ({ ...patch })),
      }
    } finally {
      this.committing.delete(proposalId)
    }
  }

  private require(proposalId: string): AiProposal {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`)
    return proposal
  }

  private persist(proposal: AiProposal, kind: ProposalStateEventKind = 'updated'): void {
    const next = cloneProposal(proposal)
    const notify = () => {
      if (!this.eventScope) return
      proposalStateEvents.publish({
        ...this.eventScope,
        proposalId: next.id,
        status: next.status,
        kind,
        ...(next.updatedAt === undefined ? {} : { updatedAt: next.updatedAt }),
      })
    }

    if (!this.store) {
      notify()
      return
    }

    const write = this.persistenceTail
      .catch(() => undefined)
      .then(() => this.ready)
      .then(() => this.store!.save(cloneProposal(next)))
    this.persistenceTail = write
    void write.then(notify, notify)
    void write.catch(() => undefined)
  }

  private async persistAndWait(proposal: AiProposal, kind: ProposalStateEventKind = 'updated'): Promise<void> {
    this.persist(proposal, kind)
    await this.persistenceTail
  }
}

export class IndexedDbProposalStore implements ProposalStore {
  async list(): Promise<AiProposal[]> {
    const proposals = await db.getAll<AiProposal>('aiProposals')
    return proposals.map(cloneProposal)
  }

  save(proposal: AiProposal): Promise<void> {
    return db.put('aiProposals', cloneProposal(proposal))
  }
}

export function proposalFromContinuation(
  result: TaskResult,
  input: { id: string; documentId: string; baseRevision: number; at: number; createdAt?: number; sourceHash?: string },
): AiProposal {
  const text = requireTextResult(result)
  return {
    id: input.id,
    taskId: result.taskId,
    documentId: input.documentId,
    baseRevision: input.baseRevision,
    patches: [{ documentId: input.documentId, from: input.at, to: input.at, text }],
    status: 'pending',
    createdAt: input.createdAt ?? Date.now(),
    sourceHash: input.sourceHash,
  }
}

export function proposalFromPatch(
  result: TaskResult,
  input: { id: string; documentId: string; baseRevision: number; createdAt?: number; sourceHash?: string },
): AiProposal {
  const patch = requirePatchResult(result)
  if (!isTextPatch(patch)) throw new Error('Rewrite output must contain one valid text patch')
  return {
    id: input.id,
    taskId: result.taskId,
    documentId: input.documentId,
    baseRevision: input.baseRevision,
    patches: [{ ...patch, documentId: input.documentId }],
    status: 'pending',
    createdAt: input.createdAt ?? Date.now(),
    sourceHash: input.sourceHash,
  }
}

function isTextPatch(value: unknown): value is Omit<TextPatch, 'documentId'> {
  if (!value || typeof value !== 'object') return false
  const patch = value as Record<string, unknown>
  return (
    Number.isInteger(patch.from) &&
    Number.isInteger(patch.to) &&
    (patch.from as number) >= 0 &&
    (patch.to as number) >= (patch.from as number) &&
    typeof patch.text === 'string'
  )
}

function validateProposal(proposal: AiProposal): void {
  if (!proposal.id.trim() || !proposal.taskId.trim() || !proposal.documentId.trim()) {
    throw new Error('Proposal identifiers must not be empty')
  }
  if (!Number.isInteger(proposal.baseRevision) || proposal.baseRevision < 0) {
    throw new Error('Proposal base revision must be a non-negative integer')
  }
  if (proposal.patches.length === 0) throw new Error('Proposal requires at least one patch')
  validatePatches(proposal.patches, proposal.documentId)
}

function validatePatches(patches: TextPatch[], documentId: string): void {
  let previousTo = -1
  for (const patch of patches) {
    if (patch.documentId !== documentId || !isTextPatch(patch)) throw new Error('Proposal contains an invalid text patch')
    if (patch.from < previousTo) throw new Error('Proposal patches must be ordered and non-overlapping')
    previousTo = patch.to
  }
}

export function hashText(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function cloneProposal(proposal: AiProposal): AiProposal {
  return {
    ...proposal,
    patches: proposal.patches.map((patch) => ({ ...patch })),
    inversePatches: proposal.inversePatches?.map((patch) => ({ ...patch })),
  }
}
