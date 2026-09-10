import type { TaskResult } from '@inkpi/protocol'
import { DB_NAME, db } from '../../db/indexedDB'
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

type ProposalOperation = 'commit' | 'undo'

interface ProposalOperationClaim {
  proposalId: string
  operation: ProposalOperation
  token: string
  expected: AiProposal
}

interface AtomicProposalStore extends ProposalStore {
  compareAndSwapProposal(expected: AiProposal, next: AiProposal): Promise<boolean>
  acquireProposalOperation(
    expected: AiProposal,
    operation: ProposalOperation,
  ): Promise<ProposalOperationClaim | undefined>
  completeProposalOperation(claim: ProposalOperationClaim, next: AiProposal): Promise<boolean>
  releaseProposalOperation(claim: ProposalOperationClaim): Promise<void>
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
  private readonly atomicStore?: AtomicProposalStore
  private readonly eventScope?: ProposalEventScope
  private persistenceTail: Promise<void> = Promise.resolve()
  private reloadTail: Promise<void> = Promise.resolve()
  readonly ready: Promise<void>

  constructor(options: ProposalLedgerOptions = {}) {
    this.now = options.now ?? Date.now
    this.store = options.store
    this.atomicStore = asAtomicProposalStore(this.store)
    this.eventScope = options.eventScope
    this.ready = this.store
      ? this.store.list().then((proposals) => {
          for (const proposal of proposals) {
            validateProposal(proposal)
            if (!this.proposals.has(proposal.id))
              this.proposals.set(proposal.id, cloneProposal(proposal))
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
    change: {
      patches?: TextPatch[]
      explanation?: string
      baseRevision?: number
      sourceHash?: string
    },
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
    if (
      proposal.status !== 'stale' &&
      proposal.status !== 'pending' &&
      proposal.status !== 'accepted'
    ) {
      throw new Error(`Proposal ${proposalId} cannot be rebased from ${proposal.status}`)
    }
    if (!Number.isInteger(currentRevision) || currentRevision < 0)
      throw new Error('Invalid rebase revision')
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
    apply: (
      patches: TextPatch[],
      nextRevision: number,
    ) => CommitApplyResult | Promise<CommitApplyResult>,
    currentSourceHash?: string,
  ): Promise<CommitReceipt> {
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId))
      throw new Error(`Proposal ${proposalId} is already being committed`)
    if (proposal.status !== 'accepted')
      throw new Error(`Proposal ${proposalId} must be accepted before commit`)
    const expected = cloneProposal(proposal)
    if (currentRevision !== proposal.baseRevision) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistConflict(proposal, expected)
      throw new ProposalConflictError(proposal.id, proposal.baseRevision, currentRevision)
    }
    if (
      currentSourceHash !== undefined &&
      proposal.sourceHash !== undefined &&
      currentSourceHash !== proposal.sourceHash
    ) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistConflict(proposal, expected)
      throw new Error(`Proposal ${proposal.id} source hash does not match the current document`)
    }
    const nextRevision = currentRevision + 1
    this.committing.add(proposalId)
    let claim: ProposalOperationClaim | undefined
    let completed = false
    let applyResult: CommitApplyResult
    try {
      if (this.store) {
        await this.ready
        await this.persistenceTail
      }
      claim = this.atomicStore
        ? await this.atomicStore.acquireProposalOperation(expected, 'commit')
        : undefined
      if (this.atomicStore && !claim) {
        this.markLocalConflict(proposal)
        throw new ProposalConflictError(proposal.id, proposal.baseRevision, nextRevision)
      }

      applyResult = await apply(
        expected.patches.map((patch) => ({ ...patch })),
        nextRevision,
      )
      const next = cloneProposal(expected)
      next.inversePatches =
        applyResult && 'inversePatches' in applyResult
          ? applyResult.inversePatches?.map((patch) => ({ ...patch }))
          : next.inversePatches
      next.status = 'committed'
      next.committedRevision = nextRevision
      next.updatedAt = this.now()

      if (claim) {
        const saved = await this.atomicStore!.completeProposalOperation(claim, next)
        if (!saved) {
          this.markLocalConflict(proposal)
          throw new ProposalConflictError(proposal.id, proposal.baseRevision, nextRevision)
        }
        completed = true
        this.replaceProposal(proposal, next)
        this.notify(next, 'updated')
      } else {
        this.replaceProposal(proposal, next)
        await this.persistAndWait(proposal)
      }
    } finally {
      if (claim && !completed) {
        try {
          await this.atomicStore!.releaseProposalOperation(claim)
        } catch {
          // Preserve the original apply or CAS error; the persisted claim keeps the operation exclusive.
        }
      }
      this.committing.delete(proposalId)
    }

    const committed = this.get(proposalId)!
    return {
      proposalId: committed.id,
      documentId: committed.documentId,
      revision: nextRevision,
      patches: committed.patches.map((patch) => ({ ...patch })),
      inversePatches: committed.inversePatches?.map((patch) => ({ ...patch })),
    }
  }

  async undo(
    proposalId: string,
    currentRevision: number,
    apply: (patches: TextPatch[], nextRevision: number) => void | Promise<void>,
  ): Promise<CommitReceipt> {
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId))
      throw new Error(`Proposal ${proposalId} is already being committed`)
    if (proposal.status !== 'committed') throw new Error(`Proposal ${proposalId} is not committed`)
    if (!proposal.inversePatches?.length)
      throw new Error(`Proposal ${proposalId} has no inverse patches`)
    const expected = cloneProposal(proposal)
    if (currentRevision !== proposal.committedRevision) {
      proposal.status = 'stale'
      proposal.updatedAt = this.now()
      await this.persistConflict(proposal, expected)
      throw new ProposalConflictError(
        proposal.id,
        proposal.committedRevision ?? currentRevision,
        currentRevision,
      )
    }
    const nextRevision = currentRevision + 1
    this.committing.add(proposalId)
    let claim: ProposalOperationClaim | undefined
    let completed = false
    try {
      if (this.store) {
        await this.ready
        await this.persistenceTail
      }
      claim = this.atomicStore
        ? await this.atomicStore.acquireProposalOperation(expected, 'undo')
        : undefined
      if (this.atomicStore && !claim) {
        this.markLocalConflict(proposal)
        throw new ProposalConflictError(
          proposal.id,
          proposal.committedRevision ?? currentRevision,
          nextRevision,
        )
      }

      await apply(
        expected.inversePatches!.map((patch) => ({ ...patch })),
        nextRevision,
      )
      const next = cloneProposal(expected)
      next.status = 'undone'
      next.updatedAt = this.now()

      if (claim) {
        const saved = await this.atomicStore!.completeProposalOperation(claim, next)
        if (!saved) {
          this.markLocalConflict(proposal)
          throw new ProposalConflictError(
            proposal.id,
            proposal.committedRevision ?? currentRevision,
            nextRevision,
          )
        }
        completed = true
        this.replaceProposal(proposal, next)
        this.notify(next, 'updated')
      } else {
        this.replaceProposal(proposal, next)
        await this.persistAndWait(proposal)
      }
      return {
        proposalId: next.id,
        documentId: next.documentId,
        revision: nextRevision,
        patches: next.inversePatches!.map((patch) => ({ ...patch })),
      }
    } finally {
      if (claim && !completed) {
        try {
          await this.atomicStore!.releaseProposalOperation(claim)
        } catch {
          // Preserve the original apply or CAS error; the persisted claim keeps the operation exclusive.
        }
      }
      this.committing.delete(proposalId)
    }
  }

  private require(proposalId: string): AiProposal {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`)
    return proposal
  }

  private replaceProposal(target: AiProposal, next: AiProposal): void {
    target.patches = next.patches.map((patch) => ({ ...patch }))
    target.inversePatches = next.inversePatches?.map((patch) => ({ ...patch }))
    target.status = next.status
    target.updatedAt = next.updatedAt
    target.sourceHash = next.sourceHash
    target.baseRevision = next.baseRevision
    target.committedRevision = next.committedRevision
    target.explanation = next.explanation
    this.proposals.set(target.id, target)
  }

  private markLocalConflict(proposal: AiProposal): void {
    proposal.status = 'stale'
    proposal.updatedAt = this.now()
    this.notify(proposal, 'conflict')
  }

  private async persistConflict(proposal: AiProposal, expected: AiProposal): Promise<void> {
    if (this.atomicStore) {
      await this.ready
      await this.persistenceTail
      const next = cloneProposal(proposal)
      try {
        await this.atomicStore.compareAndSwapProposal(expected, next)
      } finally {
        this.notify(next, 'conflict')
      }
      return
    }

    await this.persistAndWait(proposal, 'conflict')
  }

  private notify(proposal: AiProposal, kind: ProposalStateEventKind): void {
    if (!this.eventScope) return
    proposalStateEvents.publish({
      ...this.eventScope,
      proposalId: proposal.id,
      status: proposal.status,
      kind,
      ...(proposal.updatedAt === undefined ? {} : { updatedAt: proposal.updatedAt }),
    })
  }

  private persist(proposal: AiProposal, kind: ProposalStateEventKind = 'updated'): void {
    const next = cloneProposal(proposal)
    const notify = () => this.notify(next, kind)

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

  private async persistAndWait(
    proposal: AiProposal,
    kind: ProposalStateEventKind = 'updated',
  ): Promise<void> {
    this.persist(proposal, kind)
    await this.persistenceTail
  }
}

const PROPOSAL_STORE_NAME = 'aiProposals'
const OPERATION_LOCK_PREFIX = '__inkpi-proposal-operation__:'
const OPERATION_PROBE_KEY = `${OPERATION_LOCK_PREFIX}probe`

interface ProposalOperationLock {
  id: string
  proposalId: string
  operation: ProposalOperation
  token: string
}

export class IndexedDbProposalStore implements ProposalStore {
  private atomicDbPromise: Promise<IDBDatabase> | undefined

  async list(): Promise<AiProposal[]> {
    const proposals = await db.getAll<AiProposal | ProposalOperationLock>(PROPOSAL_STORE_NAME)
    return proposals
      .filter((proposal): proposal is AiProposal => !isProposalOperationLock(proposal))
      .map(cloneProposal)
  }

  save(proposal: AiProposal): Promise<void> {
    return this.openAtomicDb().then((database) =>
      runProposalTransaction(database, 'readwrite', (store, setResult, fail) => {
        readProposalAndLock(store, proposal.id, fail, (current, lock) => {
          if (lock) {
            fail(new Error(`Proposal ${proposal.id} has an operation in progress`))
            return
          }
          if (!proposalSaveAllowed(current, proposal)) {
            fail(new Error(`Proposal ${proposal.id} has already reached a terminal state`))
            return
          }
          store.put(cloneProposal(proposal))
          setResult(undefined)
        })
      }),
    )
  }

  compareAndSwapProposal(expected: AiProposal, next: AiProposal): Promise<boolean> {
    return this.openAtomicDb().then((database) =>
      runProposalTransaction(database, 'readwrite', (store, setResult, fail) => {
        readProposalAndLock(store, expected.id, fail, (current, lock) => {
          if (lock || !proposalsEqual(current, expected)) {
            setResult(false)
            return
          }
          store.put(cloneProposal(next))
          setResult(true)
        })
      }),
    )
  }

  acquireProposalOperation(
    expected: AiProposal,
    operation: ProposalOperation,
  ): Promise<ProposalOperationClaim | undefined> {
    return this.openAtomicDb().then((database) =>
      runProposalTransaction(database, 'readwrite', (store, setResult, fail) => {
        readProposalAndLock(store, expected.id, fail, (current, lock) => {
          if (lock || !proposalsEqual(current, expected)) {
            setResult(undefined)
            return
          }

          const claim: ProposalOperationClaim = {
            proposalId: expected.id,
            operation,
            token: createOperationToken(),
            expected: cloneProposal(expected),
          }
          store.put({
            id: operationLockKey(expected.id),
            proposalId: expected.id,
            operation,
            token: claim.token,
          } satisfies ProposalOperationLock)
          setResult(claim)
        })
      }),
    )
  }

  completeProposalOperation(claim: ProposalOperationClaim, next: AiProposal): Promise<boolean> {
    return this.openAtomicDb().then((database) =>
      runProposalTransaction(database, 'readwrite', (store, setResult, fail) => {
        readProposalAndLock(store, claim.proposalId, fail, (current, lock) => {
          if (
            !isProposalOperationLock(lock) ||
            lock.proposalId !== claim.proposalId ||
            lock.operation !== claim.operation ||
            lock.token !== claim.token ||
            next.id !== claim.proposalId ||
            !proposalsEqual(current, claim.expected)
          ) {
            setResult(false)
            return
          }

          store.put(cloneProposal(next))
          store.delete(operationLockKey(claim.proposalId))
          setResult(true)
        })
      }),
    )
  }

  releaseProposalOperation(claim: ProposalOperationClaim): Promise<void> {
    return this.openAtomicDb().then((database) =>
      runProposalTransaction(database, 'readwrite', (store, setResult, fail) => {
        const lockRequest = store.get(operationLockKey(claim.proposalId))
        lockRequest.onerror = () => fail(lockRequest.error)
        lockRequest.onsuccess = () => {
          const lock = lockRequest.result
          if (
            isProposalOperationLock(lock) &&
            lock.proposalId === claim.proposalId &&
            lock.operation === claim.operation &&
            lock.token === claim.token
          ) {
            store.delete(operationLockKey(claim.proposalId))
          }
          setResult(undefined)
        }
      }),
    )
  }

  private openAtomicDb(): Promise<IDBDatabase> {
    if (this.atomicDbPromise) return this.atomicDbPromise

    this.atomicDbPromise = db.get<unknown>(PROPOSAL_STORE_NAME, OPERATION_PROBE_KEY).then(
      () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME)
          request.onerror = () =>
            reject(request.error ?? new Error('Unable to open the proposal database'))
          request.onsuccess = () => {
            const database = request.result
            database.onversionchange = () => {
              database.close()
              this.atomicDbPromise = undefined
            }
            resolve(database)
          }
        }),
    )
    return this.atomicDbPromise
  }
}

function asAtomicProposalStore(store: ProposalStore | undefined): AtomicProposalStore | undefined {
  if (!store) return undefined
  const candidate = store as Partial<AtomicProposalStore>
  if (
    typeof candidate.compareAndSwapProposal !== 'function' ||
    typeof candidate.acquireProposalOperation !== 'function' ||
    typeof candidate.completeProposalOperation !== 'function' ||
    typeof candidate.releaseProposalOperation !== 'function'
  )
    return undefined
  return store as AtomicProposalStore
}

function runProposalTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    setResult: (result: T) => void,
    fail: (error: unknown) => void,
  ) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(PROPOSAL_STORE_NAME, mode)
    } catch (error) {
      reject(error)
      return
    }

    let result!: T
    let hasResult = false
    let failure: Error | undefined
    let settled = false

    const rejectOnce = (error: unknown) => {
      if (settled) return
      settled = true
      reject(toError(error))
    }
    const fail = (error: unknown) => {
      failure = toError(error)
      try {
        transaction.abort()
      } catch {
        rejectOnce(failure)
      }
    }

    transaction.onerror = () =>
      rejectOnce(failure ?? transaction.error ?? new Error('Proposal transaction failed'))
    transaction.onabort = () =>
      rejectOnce(failure ?? transaction.error ?? new Error('Proposal transaction aborted'))
    transaction.oncomplete = () => {
      if (settled) return
      settled = true
      if (failure) {
        reject(failure)
      } else if (hasResult) {
        resolve(result)
      } else {
        reject(new Error('Proposal transaction did not produce a result'))
      }
    }

    try {
      operation(
        transaction.objectStore(PROPOSAL_STORE_NAME),
        (next) => {
          result = next
          hasResult = true
        },
        fail,
      )
    } catch (error) {
      fail(error)
    }
  })
}

function readProposalAndLock(
  store: IDBObjectStore,
  proposalId: string,
  fail: (error: unknown) => void,
  onReady: (proposal: AiProposal | undefined, lock: unknown) => void,
): void {
  let proposalLoaded = false
  let lockLoaded = false
  let proposal: AiProposal | undefined
  let lock: unknown

  const maybeReady = () => {
    if (proposalLoaded && lockLoaded) onReady(proposal, lock)
  }

  const proposalRequest = store.get(proposalId)
  proposalRequest.onerror = () => fail(proposalRequest.error)
  proposalRequest.onsuccess = () => {
    proposal = proposalRequest.result as AiProposal | undefined
    proposalLoaded = true
    maybeReady()
  }

  const lockRequest = store.get(operationLockKey(proposalId))
  lockRequest.onerror = () => fail(lockRequest.error)
  lockRequest.onsuccess = () => {
    lock = lockRequest.result
    lockLoaded = true
    maybeReady()
  }
}

function operationLockKey(proposalId: string): string {
  return `${OPERATION_LOCK_PREFIX}${proposalId}`
}

function createOperationToken(): string {
  const randomUuid = globalThis.crypto?.randomUUID
  return typeof randomUuid === 'function'
    ? randomUuid.call(globalThis.crypto)
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function isProposalOperationLock(value: unknown): value is ProposalOperationLock {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProposalOperationLock>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.startsWith(OPERATION_LOCK_PREFIX) &&
    typeof candidate.proposalId === 'string' &&
    (candidate.operation === 'commit' || candidate.operation === 'undo') &&
    typeof candidate.token === 'string'
  )
}

function proposalsEqual(value: unknown, expected: AiProposal): boolean {
  if (!value || typeof value !== 'object') return false
  const candidate = value as AiProposal
  return (
    candidate.id === expected.id &&
    candidate.taskId === expected.taskId &&
    candidate.documentId === expected.documentId &&
    candidate.baseRevision === expected.baseRevision &&
    candidate.status === expected.status &&
    candidate.createdAt === expected.createdAt &&
    candidate.updatedAt === expected.updatedAt &&
    candidate.sourceHash === expected.sourceHash &&
    candidate.committedRevision === expected.committedRevision &&
    candidate.explanation === expected.explanation &&
    patchesEqual(candidate.patches, expected.patches) &&
    patchesEqual(candidate.inversePatches, expected.inversePatches)
  )
}

function proposalSaveAllowed(current: AiProposal | undefined, next: AiProposal): boolean {
  if (!current) return true
  if (current.status !== 'committed' && current.status !== 'undone') return true
  return proposalsEqual(current, next)
}

function patchesEqual(left: TextPatch[] | undefined, right: TextPatch[] | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  if (left.length !== right.length) return false
  return left.every((patch, index) => {
    const other = right[index]
    return (
      patch.documentId === other.documentId &&
      patch.from === other.from &&
      patch.to === other.to &&
      patch.text === other.text
    )
  })
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error ?? 'Unknown proposal transaction error'))
}

export function proposalFromContinuation(
  result: TaskResult,
  input: {
    id: string
    documentId: string
    baseRevision: number
    at: number
    createdAt?: number
    sourceHash?: string
  },
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
  input: {
    id: string
    documentId: string
    baseRevision: number
    createdAt?: number
    sourceHash?: string
  },
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
    if (patch.documentId !== documentId || !isTextPatch(patch))
      throw new Error('Proposal contains an invalid text patch')
    if (patch.from < previousTo)
      throw new Error('Proposal patches must be ordered and non-overlapping')
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
