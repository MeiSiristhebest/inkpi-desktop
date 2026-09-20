import type {
  DomainProposal,
  DomainProposalCommitReceipt,
  DomainProposalStatus,
  ProposalSyncPushResult,
} from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { assertStoryState, type StoryState } from '../../domain/story'
import type { StoryStateStore } from '../../ports/storyStateStore'
import { validateDomainProposal } from './domainProposal'

export interface DomainProposalConflict {
  expectedRevision: number
  actualRevision: number
  reason: 'revision' | 'source-hash' | 'unsafe-rebase'
  at: number
}

/** Desktop-local review record around the domain-neutral Runtime proposal. */
export interface DomainProposalRecord extends DomainProposal {
  status: DomainProposalStatus
  createdAt: number
  updatedAt?: number
  inversePatch?: unknown
  committedRevision?: number
  conflict?: DomainProposalConflict
}

export interface DomainProposalRecordStore {
  list(workspaceId: string): Promise<DomainProposalRecord[]>
  save(workspaceId: string, proposal: DomainProposalRecord): Promise<void>
}

export interface DomainProposalProjectionSnapshot {
  workspaceId: string
  revision: number
  proposals: DomainProposalRecord[]
  hash: string
  updatedAt: number
}

export interface DomainProposalSyncRemote {
  pushDomainProposalState(
    workspaceId: string,
    proposal: DomainProposalRecord,
    expectedRevision: number,
  ): Promise<ProposalSyncPushResult>
  snapshotDomainProposals(workspaceId: string): Promise<DomainProposalProjectionSnapshot>
}

export interface DomainProposalApplyContext {
  workspaceId: string
  proposal: DomainProposalRecord
  currentState: StoryState
  nextRevision: number
  undo: boolean
}

export interface DomainProposalApplyResult {
  state: StoryState
  inversePatch?: unknown
}

export interface DomainProposalLedgerOptions {
  workspaceId: string
  storyStateStore: StoryStateStore
  apply: (
    context: DomainProposalApplyContext,
  ) => DomainProposalApplyResult | Promise<DomainProposalApplyResult>
  store?: DomainProposalRecordStore
  now?: () => number
  currentSourceHash?: (state: StoryState) => string | undefined | Promise<string | undefined>
}

export class DomainProposalConflictError extends Error {
  readonly code = 'DOMAIN_PROPOSAL_CONFLICT'
  readonly proposalId: string
  readonly expectedRevision: number
  readonly actualRevision: number
  readonly reason: DomainProposalConflict['reason']

  constructor(
    proposalId: string,
    expectedRevision: number,
    actualRevision: number,
    reason: DomainProposalConflict['reason'] = 'revision',
  ) {
    super(
      `Domain proposal ${proposalId} is stale: expected revision ${expectedRevision}, received ${actualRevision}`,
    )
    this.name = 'DomainProposalConflictError'
    this.proposalId = proposalId
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
    this.reason = reason
  }
}

export class DomainProposalLedger {
  private readonly proposals = new Map<string, DomainProposalRecord>()
  private readonly committing = new Set<string>()
  private readonly workspaceId: string
  private readonly storyStateStore: StoryStateStore
  private readonly apply: DomainProposalLedgerOptions['apply']
  private readonly store?: DomainProposalRecordStore
  private readonly now: () => number
  private readonly currentSourceHash?: DomainProposalLedgerOptions['currentSourceHash']
  private persistenceTail: Promise<void> = Promise.resolve()
  readonly ready: Promise<void>

  constructor(options: DomainProposalLedgerOptions) {
    assertWorkspaceId(options.workspaceId)
    this.workspaceId = options.workspaceId
    this.storyStateStore = options.storyStateStore
    this.apply = options.apply
    this.store = options.store
    this.now = options.now ?? Date.now
    this.currentSourceHash = options.currentSourceHash
    this.ready = this.store
      ? this.store.list(this.workspaceId).then((records) => {
          for (const record of records) {
            validateDomainProposalRecord(record)
            if (this.proposals.has(record.id)) {
              throw new Error(`Duplicate domain proposal id: ${record.id}`)
            }
            this.proposals.set(record.id, cloneRecord(record))
          }
        })
      : Promise.resolve()
    void this.ready.catch(() => undefined)
  }

  async flush(): Promise<void> {
    await this.ready
    await this.persistenceTail
  }

  create(proposal: DomainProposal, createdAt = this.now()): DomainProposalRecord {
    validateDomainProposal(proposal)
    assertTimestamp(createdAt, 'Domain proposal createdAt')
    if (this.proposals.has(proposal.id))
      throw new Error(`Domain proposal already exists: ${proposal.id}`)
    const record: DomainProposalRecord = {
      ...cloneProposal(proposal),
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    }
    validateDomainProposalRecord(record)
    this.proposals.set(record.id, record)
    this.persist(record)
    return cloneRecord(record)
  }

  get(proposalId: string): DomainProposalRecord | undefined {
    const record = this.proposals.get(proposalId)
    return record ? cloneRecord(record) : undefined
  }

  list(): DomainProposalRecord[] {
    return [...this.proposals.values()].map(cloneRecord)
  }

  accept(proposalId: string): DomainProposalRecord {
    const proposal = this.require(proposalId)
    if (proposal.status !== 'pending')
      throw new Error(`Domain proposal ${proposalId} is not pending`)
    proposal.status = 'accepted'
    proposal.updatedAt = this.now()
    proposal.conflict = undefined
    validateDomainProposalRecord(proposal)
    this.persist(proposal)
    return cloneRecord(proposal)
  }

  reject(proposalId: string): DomainProposalRecord {
    const proposal = this.require(proposalId)
    if (proposal.status !== 'pending')
      throw new Error(`Domain proposal ${proposalId} is not pending`)
    proposal.status = 'rejected'
    proposal.updatedAt = this.now()
    proposal.conflict = undefined
    validateDomainProposalRecord(proposal)
    this.persist(proposal)
    return cloneRecord(proposal)
  }

  modify(
    proposalId: string,
    change: Partial<
      Pick<DomainProposal, 'target' | 'operation' | 'patch' | 'evidence' | 'reason' | 'sourceHash'>
    > & { baseRevision?: number },
  ): DomainProposalRecord {
    const proposal = this.require(proposalId)
    if (proposal.status === 'committed' || proposal.status === 'undone') {
      throw new Error(`Domain proposal ${proposalId} cannot be modified after ${proposal.status}`)
    }
    const next: DomainProposalRecord = {
      ...cloneRecord(proposal),
      ...(change.target === undefined ? {} : { target: { ...change.target } }),
      ...(change.operation === undefined ? {} : { operation: change.operation }),
      ...(Object.prototype.hasOwnProperty.call(change, 'patch')
        ? { patch: cloneJsonValue(change.patch) }
        : {}),
      ...(change.evidence === undefined
        ? {}
        : { evidence: change.evidence.map((evidence) => ({ ...evidence })) }),
      ...(change.reason === undefined ? {} : { reason: change.reason }),
      ...(change.sourceHash === undefined ? {} : { sourceHash: change.sourceHash }),
      ...(change.baseRevision === undefined ? {} : { baseRevision: change.baseRevision }),
      status: 'pending',
      updatedAt: this.now(),
      inversePatch: undefined,
      committedRevision: undefined,
      conflict: undefined,
    }
    validateDomainProposalRecord(next)
    this.replace(proposal, next)
    this.persist(next)
    return cloneRecord(next)
  }

  rebase(
    proposalId: string,
    currentRevision: number,
    transform: (proposal: DomainProposal) => DomainProposal = (proposal) => proposal,
  ): DomainProposalRecord {
    const proposal = this.require(proposalId)
    if (!['stale', 'pending', 'accepted'].includes(proposal.status)) {
      throw new Error(`Domain proposal ${proposalId} cannot be rebased from ${proposal.status}`)
    }
    assertRevision(currentRevision, 'Domain proposal rebase revision')
    try {
      const transformed = transform(cloneProposal(proposal))
      validateDomainProposal(transformed)
      if (transformed.id !== proposal.id || transformed.taskId !== proposal.taskId) {
        throw new Error('Domain proposal rebase cannot change proposal or task identity')
      }
      const next: DomainProposalRecord = {
        ...cloneRecord(proposal),
        ...cloneProposal(transformed),
        baseRevision: currentRevision,
        status: 'pending',
        updatedAt: this.now(),
        inversePatch: undefined,
        committedRevision: undefined,
        conflict: undefined,
      }
      validateDomainProposalRecord(next)
      this.replace(proposal, next)
      this.persist(next)
      return cloneRecord(next)
    } catch (error) {
      const next = markConflict(proposal, currentRevision, this.now(), 'unsafe-rebase')
      this.replace(proposal, next)
      this.persist(next, 'conflict')
      throw error
    }
  }

  async commit(proposalId: string): Promise<DomainProposalCommitReceipt> {
    await this.ready
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId)) {
      throw new Error(`Domain proposal ${proposalId} is already being committed`)
    }
    if (proposal.status !== 'accepted') {
      throw new Error(`Domain proposal ${proposalId} must be accepted before commit`)
    }

    this.committing.add(proposalId)
    const expected = cloneRecord(proposal)
    try {
      const currentState = await this.requireCurrentState()
      await this.assertCommitCoordinates(expected, currentState)
      const nextRevision = currentState.revision + 1
      const result = await this.apply({
        workspaceId: this.workspaceId,
        proposal: cloneRecord(expected),
        currentState: cloneStoryState(currentState),
        nextRevision,
        undo: false,
      })
      assertAppliedState(result, nextRevision)

      try {
        await this.storyStateStore.save(this.workspaceId, result.state)
      } catch (error) {
        const actualRevision = await this.markStaleAfterWriteRace(expected)
        if (actualRevision !== undefined) {
          throw new DomainProposalConflictError(expected.id, expected.baseRevision, actualRevision)
        }
        throw error
      }

      const next: DomainProposalRecord = {
        ...expected,
        status: 'committed',
        inversePatch: cloneJsonValue(result.inversePatch),
        committedRevision: nextRevision,
        updatedAt: this.now(),
        conflict: undefined,
      }
      validateDomainProposalRecord(next)
      this.replace(proposal, next)
      await this.persistAndWait(next)
      return {
        proposalId: next.id,
        target: { ...next.target },
        operation: next.operation,
        patch: cloneJsonValue(next.patch),
        inversePatch: cloneJsonValue(next.inversePatch),
        revision: nextRevision,
      }
    } catch (error) {
      if (error instanceof DomainProposalConflictError) throw error
      throw error
    } finally {
      this.committing.delete(proposalId)
    }
  }

  async undo(proposalId: string): Promise<DomainProposalCommitReceipt> {
    await this.ready
    const proposal = this.require(proposalId)
    if (this.committing.has(proposalId)) {
      throw new Error(`Domain proposal ${proposalId} is already being committed`)
    }
    if (proposal.status !== 'committed') {
      throw new Error(`Domain proposal ${proposalId} is not committed`)
    }
    if (proposal.inversePatch === undefined || proposal.committedRevision === undefined) {
      throw new Error(`Domain proposal ${proposalId} has no inverse patch`)
    }
    const committedRevision = proposal.committedRevision

    this.committing.add(proposalId)
    const expected = cloneRecord(proposal)
    try {
      const currentState = await this.requireCurrentState()
      if (currentState.revision !== committedRevision) {
        const conflict = markConflict(proposal, currentState.revision, this.now(), 'revision')
        this.replace(proposal, conflict)
        await this.persistAndWait(conflict, 'conflict')
        throw new DomainProposalConflictError(proposal.id, committedRevision, currentState.revision)
      }
      const nextRevision = currentState.revision + 1
      const undoProposal: DomainProposalRecord = {
        ...expected,
        patch: cloneJsonValue(expected.inversePatch),
      }
      const result = await this.apply({
        workspaceId: this.workspaceId,
        proposal: cloneRecord(undoProposal),
        currentState: cloneStoryState(currentState),
        nextRevision,
        undo: true,
      })
      assertAppliedState(result, nextRevision)
      try {
        await this.storyStateStore.save(this.workspaceId, result.state)
      } catch (error) {
        const actualRevision = await this.markStaleAfterWriteRace(expected)
        if (actualRevision !== undefined) {
          throw new DomainProposalConflictError(expected.id, committedRevision, actualRevision)
        }
        throw error
      }

      const next: DomainProposalRecord = {
        ...expected,
        status: 'undone',
        updatedAt: this.now(),
        conflict: undefined,
      }
      validateDomainProposalRecord(next)
      this.replace(proposal, next)
      await this.persistAndWait(next)
      return {
        proposalId: next.id,
        target: { ...next.target },
        operation: next.operation,
        patch: cloneJsonValue(expected.inversePatch),
        inversePatch: cloneJsonValue(result.inversePatch),
        revision: nextRevision,
      }
    } finally {
      this.committing.delete(proposalId)
    }
  }

  private async requireCurrentState(): Promise<StoryState> {
    const state = await this.storyStateStore.load(this.workspaceId)
    if (!state) throw new Error(`No authoritative StoryState for workspace ${this.workspaceId}`)
    assertStoryState(state)
    return state
  }

  private async assertCommitCoordinates(
    proposal: DomainProposalRecord,
    currentState: StoryState,
  ): Promise<void> {
    if (currentState.revision !== proposal.baseRevision) {
      const next = markConflict(proposal, currentState.revision, this.now(), 'revision')
      const local = this.proposals.get(proposal.id)
      if (local) this.replace(local, next)
      await this.persistAndWait(next, 'conflict')
      throw new DomainProposalConflictError(
        proposal.id,
        proposal.baseRevision,
        currentState.revision,
      )
    }
    if (proposal.sourceHash !== undefined && this.currentSourceHash) {
      const currentHash = await this.currentSourceHash(currentState)
      if (currentHash !== proposal.sourceHash) {
        const next = markConflict(proposal, currentState.revision, this.now(), 'source-hash')
        const local = this.proposals.get(proposal.id)
        if (local) this.replace(local, next)
        await this.persistAndWait(next, 'conflict')
        throw new DomainProposalConflictError(
          proposal.id,
          proposal.baseRevision,
          currentState.revision,
          'source-hash',
        )
      }
    }
  }

  private async markStaleAfterWriteRace(
    expected: DomainProposalRecord,
  ): Promise<number | undefined> {
    const current = await this.storyStateStore.load(this.workspaceId).catch(() => undefined)
    if (!current || current.revision === expected.baseRevision) return undefined
    const local = this.proposals.get(expected.id)
    if (!local) return current.revision
    const next = markConflict(local, current.revision, this.now(), 'revision')
    this.replace(local, next)
    await this.persistAndWait(next, 'conflict').catch(() => undefined)
    return current.revision
  }

  private require(proposalId: string): DomainProposalRecord {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) throw new Error(`Unknown domain proposal: ${proposalId}`)
    return proposal
  }

  private replace(target: DomainProposalRecord, next: DomainProposalRecord): void {
    this.proposals.set(target.id, cloneRecord(next))
  }

  private persist(proposal: DomainProposalRecord, _kind = 'updated'): void {
    if (!this.store) return
    const next = cloneRecord(proposal)
    const write = this.persistenceTail
      .catch(() => undefined)
      .then(() => this.ready)
      .then(() => this.store!.save(this.workspaceId, cloneRecord(next)))
    this.persistenceTail = write
    void write.catch(() => undefined)
  }

  private async persistAndWait(proposal: DomainProposalRecord, kind = 'updated'): Promise<void> {
    this.persist(proposal, kind)
    await this.persistenceTail
  }
}

const DOMAIN_PROPOSAL_KEY_PREFIX = 'domainProposal::'
const domainProposalWriteLocks = new Map<string, Promise<void>>()

interface DomainProposalEnvelope {
  key: string
  value: string
}

/** IndexedDB persistence kept separate from the legacy text proposal store. */
export class IndexedDbDomainProposalStore implements DomainProposalRecordStore {
  async list(workspaceId: string): Promise<DomainProposalRecord[]> {
    assertWorkspaceId(workspaceId)
    const prefix = proposalKeyPrefix(workspaceId)
    const records = await db.getAll<DomainProposalEnvelope>('settingsKV')
    return records
      .filter((record) => record.key.startsWith(prefix))
      .map((record) => deserializeRecord(record.value))
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  save(workspaceId: string, proposal: DomainProposalRecord): Promise<void> {
    assertWorkspaceId(workspaceId)
    validateDomainProposalRecord(proposal)
    const key = proposalKey(workspaceId, proposal.id)
    const previous = domainProposalWriteLocks.get(key) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(() =>
        db.put<DomainProposalEnvelope>('settingsKV', {
          key,
          value: serializeRecord(proposal),
        }),
      )
    domainProposalWriteLocks.set(key, current)
    return current.finally(() => {
      if (domainProposalWriteLocks.get(key) === current) domainProposalWriteLocks.delete(key)
    })
  }
}

/** Local-authoritative proposal store with an optional derived daemon projection. */
export class RemoteDomainProposalStore implements DomainProposalRecordStore {
  private readonly local: DomainProposalRecordStore
  private readonly remote?: DomainProposalSyncRemote
  private readonly workspaceId: string
  private projectionRevision: number | undefined
  private projectionRemote: DomainProposalSyncRemote | undefined
  private writeTail: Promise<void> = Promise.resolve()

  constructor(options: {
    workspaceId: string
    local: DomainProposalRecordStore
    remote?: DomainProposalSyncRemote
  }) {
    assertWorkspaceId(options.workspaceId)
    this.workspaceId = options.workspaceId
    this.local = options.local
    this.remote = options.remote
  }

  list(workspaceId = this.workspaceId): Promise<DomainProposalRecord[]> {
    if (workspaceId !== this.workspaceId) throw new Error('Domain proposal workspace mismatch')
    return this.local.list(workspaceId).then((records) => records.map(cloneRecord))
  }

  save(workspaceId: string, proposal: DomainProposalRecord): Promise<void> {
    if (workspaceId !== this.workspaceId) throw new Error('Domain proposal workspace mismatch')
    validateDomainProposalRecord(proposal)
    const next = cloneRecord(proposal)
    const operation = this.writeTail
      .catch(() => undefined)
      .then(async () => {
        // Local persistence is authoritative and must succeed before projection.
        await this.local.save(this.workspaceId, cloneRecord(next))
        if (!this.remote) return
        const expectedRevision = await this.ensureProjectionRevision(this.remote)
        const result = await this.remote.pushDomainProposalState(
          this.workspaceId,
          cloneRecord(next),
          expectedRevision,
        )
        if (!result.accepted) {
          this.projectionRevision = isRevision(result.revision) ? result.revision : undefined
          throw new Error(
            `Domain proposal projection rejected ${next.id}: ${result.reason ?? 'unknown reason'}`,
          )
        }
        this.projectionRevision = requireRevision(result.revision, 'domain proposal push result')
        if (result.duplicate) {
          const snapshot = await this.remote.snapshotDomainProposals(this.workspaceId)
          this.projectionRevision = requireRevision(snapshot.revision, 'domain proposal snapshot')
        }
      })
    this.writeTail = operation.catch(() => undefined)
    return operation
  }

  async flush(): Promise<void> {
    await this.writeTail
  }

  private async ensureProjectionRevision(remote: DomainProposalSyncRemote): Promise<number> {
    if (this.projectionRemote !== remote) {
      this.projectionRemote = remote
      this.projectionRevision = undefined
    }
    if (this.projectionRevision === undefined) {
      const snapshot = await remote.snapshotDomainProposals(this.workspaceId)
      this.projectionRevision = requireRevision(snapshot.revision, 'domain proposal snapshot')
    }
    return this.projectionRevision
  }
}

export class InMemoryDomainProposalStore implements DomainProposalRecordStore {
  private readonly records = new Map<string, DomainProposalRecord>()

  async list(workspaceId: string): Promise<DomainProposalRecord[]> {
    assertWorkspaceId(workspaceId)
    const prefix = `${workspaceId}:`
    return [...this.records.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, record]) => cloneRecord(record))
  }

  async save(workspaceId: string, proposal: DomainProposalRecord): Promise<void> {
    assertWorkspaceId(workspaceId)
    validateDomainProposalRecord(proposal)
    this.records.set(`${workspaceId}:${proposal.id}`, cloneRecord(proposal))
  }
}

export function validateDomainProposalRecord(
  value: unknown,
): asserts value is DomainProposalRecord {
  if (!isRecord(value)) throw new Error('Domain proposal record must be an object')
  validateDomainProposal(value as unknown as DomainProposal)
  if (!isDomainProposalStatus(value.status)) throw new Error('Domain proposal status is invalid')
  assertRevision(value.baseRevision, 'Domain proposal base revision')
  assertTimestamp(value.createdAt, 'Domain proposal createdAt')
  if (value.updatedAt !== undefined) assertTimestamp(value.updatedAt, 'Domain proposal updatedAt')
  if (value.committedRevision !== undefined) {
    assertRevision(value.committedRevision, 'Domain proposal committed revision')
  }
  if (value.sourceHash !== undefined && typeof value.sourceHash !== 'string') {
    throw new Error('Domain proposal source hash must be a string')
  }
  if (value.patch !== undefined) assertJsonValue(value.patch, 'Domain proposal patch')
  if (value.inversePatch !== undefined) {
    assertJsonValue(value.inversePatch, 'Domain proposal inverse patch')
  }
  if (value.conflict !== undefined) assertConflict(value.conflict)
}

function markConflict(
  proposal: DomainProposalRecord,
  actualRevision: number,
  at: number,
  reason: DomainProposalConflict['reason'],
): DomainProposalRecord {
  assertRevision(actualRevision, 'Domain proposal conflict revision')
  return {
    ...cloneRecord(proposal),
    status: 'stale',
    updatedAt: at,
    conflict: {
      expectedRevision: proposal.baseRevision,
      actualRevision,
      reason,
      at,
    },
  }
}

function assertAppliedState(
  result: DomainProposalApplyResult,
  expectedRevision: number,
): asserts result is DomainProposalApplyResult & { state: StoryState } {
  if (!isRecord(result)) throw new Error('Domain proposal apply result must be an object')
  assertStoryState(result.state)
  if (result.state.revision !== expectedRevision) {
    throw new Error(
      `Domain proposal apply result must advance StoryState to revision ${expectedRevision}`,
    )
  }
  if (result.inversePatch !== undefined) assertJsonValue(result.inversePatch, 'inversePatch')
}

function assertConflict(value: unknown): asserts value is DomainProposalConflict {
  if (!isRecord(value)) throw new Error('Domain proposal conflict must be an object')
  assertRevision(value.expectedRevision, 'Domain proposal conflict expected revision')
  assertRevision(value.actualRevision, 'Domain proposal conflict actual revision')
  assertTimestamp(value.at, 'Domain proposal conflict timestamp')
  if (
    value.reason !== 'revision' &&
    value.reason !== 'source-hash' &&
    value.reason !== 'unsafe-rebase'
  ) {
    throw new Error('Domain proposal conflict reason is invalid')
  }
}

function assertWorkspaceId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Domain proposal workspace id must not be empty')
  }
}

function assertRevision(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative safe integer`)
  }
}

function assertTimestamp(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative safe integer`)
  }
}

function isDomainProposalStatus(value: unknown): value is DomainProposalStatus {
  return (
    value === 'pending' ||
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'stale' ||
    value === 'committed' ||
    value === 'undone'
  )
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function requireRevision(value: unknown, source: string): number {
  if (!isRevision(value)) throw new Error(`${source} revision is invalid`)
  return value
}

function assertJsonValue(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`)
    return
  }
  if (typeof value !== 'object') throw new Error(`${path} contains an unsupported value`)
  if (seen.has(value)) throw new Error(`${path} contains a cyclic value`)
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item === undefined) throw new Error(`${path}[${index}] is undefined`)
        assertJsonValue(item, `${path}[${index}]`, seen)
      })
      return
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains an unsupported object type`)
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) throw new Error(`${path}.${key} is undefined`)
      assertJsonValue(item, `${path}.${key}`, seen)
    }
  } finally {
    seen.delete(value)
  }
}

function cloneProposal(proposal: DomainProposal): DomainProposal {
  return {
    ...proposal,
    target: { ...proposal.target },
    patch: cloneJsonValue(proposal.patch),
    evidence: proposal.evidence?.map((evidence) => ({ ...evidence })),
  }
}

function cloneRecord(record: DomainProposalRecord): DomainProposalRecord {
  return {
    ...cloneProposal(record),
    status: record.status,
    createdAt: record.createdAt,
    ...(record.updatedAt === undefined ? {} : { updatedAt: record.updatedAt }),
    ...(record.inversePatch === undefined
      ? {}
      : { inversePatch: cloneJsonValue(record.inversePatch) }),
    ...(record.committedRevision === undefined
      ? {}
      : { committedRevision: record.committedRevision }),
    ...(record.conflict === undefined ? {} : { conflict: { ...record.conflict } }),
  }
}

function cloneStoryState(state: StoryState): StoryState {
  return structuredClone(state)
}

function cloneJsonValue<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item)) as T
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = cloneJsonValue(item)
  }
  return result as T
}

function proposalKeyPrefix(workspaceId: string): string {
  return `${DOMAIN_PROPOSAL_KEY_PREFIX}${encodeURIComponent(workspaceId)}::`
}

function proposalKey(workspaceId: string, proposalId: string): string {
  return `${proposalKeyPrefix(workspaceId)}${encodeURIComponent(proposalId)}`
}

function serializeRecord(record: DomainProposalRecord): string {
  validateDomainProposalRecord(record)
  const serialized = JSON.stringify(canonicalize(record))
  if (serialized === undefined) throw new Error('Domain proposal record is not serializable')
  return serialized
}

function deserializeRecord(serialized: string): DomainProposalRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('Stored domain proposal record is not valid JSON')
  }
  validateDomainProposalRecord(parsed)
  return cloneRecord(parsed)
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => canonicalize(item) ?? null)
  const record = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    const item = canonicalize(record[key])
    if (item !== undefined) sorted[key] = item
  }
  return sorted
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
