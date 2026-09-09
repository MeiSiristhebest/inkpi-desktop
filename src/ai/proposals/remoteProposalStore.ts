import type { ProposalSyncPushResult, TaskResult } from '@inkpi/protocol'
import type { ProposalSyncRemote } from '../../adapters/daemonDomainSyncRemote'
import { IndexedDbProposalStore, type AiProposal, type ProposalStore } from './proposalLedger'

export type ProposalSyncRemoteProvider = () => ProposalSyncRemote | undefined
export type ProposalSyncRemoteSource = ProposalSyncRemote | ProposalSyncRemoteProvider

export interface RemoteProposalStoreOptions {
  workspaceId: string
  remote?: ProposalSyncRemoteSource
  local?: ProposalStore
  localStore?: ProposalStore
}

export type ProposalSyncFailureReason = NonNullable<ProposalSyncPushResult['reason']>
export type ProposalSyncErrorCode =
  | 'PROPOSAL_SYNC_REVISION_CONFLICT'
  | 'PROPOSAL_SYNC_HASH_MISMATCH'
  | 'PROPOSAL_SYNC_REJECTED'

/** A daemon projection rejected a local proposal state update. */
export class ProposalSyncError extends Error {
  readonly code: ProposalSyncErrorCode
  readonly reason: ProposalSyncFailureReason | undefined
  readonly workspaceId: string
  readonly proposalId: string
  readonly expectedRevision: number
  readonly actualRevision: number
  readonly currentHash?: string
  readonly result: ProposalSyncPushResult

  constructor(
    workspaceId: string,
    proposalId: string,
    expectedRevision: number,
    result: ProposalSyncPushResult,
  ) {
    const reason = result.reason ?? 'rejected'
    super(
      `Proposal sync ${reason} for ${proposalId}: expected projection revision ${expectedRevision}, received ${result.revision}`,
    )
    this.name = 'ProposalSyncError'
    this.code =
      result.reason === 'revision-conflict'
        ? 'PROPOSAL_SYNC_REVISION_CONFLICT'
        : result.reason === 'hash-mismatch'
          ? 'PROPOSAL_SYNC_HASH_MISMATCH'
          : 'PROPOSAL_SYNC_REJECTED'
    this.reason = result.reason
    this.workspaceId = workspaceId
    this.proposalId = proposalId
    this.expectedRevision = expectedRevision
    this.actualRevision = result.revision
    this.currentHash = result.currentHash
    this.result = result
  }
}

export function isProposalSyncError(error: unknown): error is ProposalSyncError {
  if (error instanceof ProposalSyncError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; reason?: unknown }
  return (
    (candidate.code === 'PROPOSAL_SYNC_REVISION_CONFLICT' ||
      candidate.code === 'PROPOSAL_SYNC_HASH_MISMATCH' ||
      candidate.code === 'PROPOSAL_SYNC_REJECTED') &&
    (candidate.reason === undefined ||
      candidate.reason === 'revision-conflict' ||
      candidate.reason === 'hash-mismatch' ||
      candidate.reason === 'invalid-proposal')
  )
}

/**
 * The existing task callback only returns TaskResult. Keep the remote out of
 * the wire result while preserving it across that callback boundary.
 */
const taskResultRemotes = new WeakMap<object, ProposalSyncRemote>()

export function attachProposalSyncRemote(
  result: TaskResult | null,
  remote: ProposalSyncRemote,
): TaskResult | null {
  if (result && typeof result === 'object') taskResultRemotes.set(result, remote)
  return result
}

export function getProposalSyncRemote(result: TaskResult | null | undefined): ProposalSyncRemote | undefined {
  return result && typeof result === 'object' ? taskResultRemotes.get(result) : undefined
}

/**
 * IndexedDB is written before the daemon projection. The projection is only
 * updated after that local write and is never used as the source of list().
 */
export class RemoteProposalStore implements ProposalStore {
  private readonly local: ProposalStore
  private readonly workspaceId: string
  private readonly remoteProvider: () => ProposalSyncRemote | undefined
  private projectionRevision: number | undefined
  private projectionRemote: ProposalSyncRemote | undefined
  private writeTail: Promise<void> = Promise.resolve()

  constructor(options: RemoteProposalStoreOptions)
  constructor(local: ProposalStore, remote: ProposalSyncRemote, workspaceId: string)
  constructor(remote: ProposalSyncRemote, workspaceId: string, local?: ProposalStore)
  constructor(
    first: RemoteProposalStoreOptions | ProposalStore | ProposalSyncRemote,
    second?: ProposalSyncRemote | string,
    third?: string | ProposalStore,
  ) {
    let local: ProposalStore
    let remote: ProposalSyncRemoteSource | undefined
    let workspaceId: string

    if (isOptions(first)) {
      local = first.local ?? first.localStore ?? new IndexedDbProposalStore()
      remote = first.remote
      workspaceId = first.workspaceId
    } else if (typeof second === 'string') {
      local = isProposalStore(third) ? third : new IndexedDbProposalStore()
      remote = first as ProposalSyncRemote
      workspaceId = second
    } else {
      local = first as ProposalStore
      remote = second as ProposalSyncRemote
      workspaceId = third as string
    }

    if (!workspaceId || !workspaceId.trim()) {
      throw new Error('Proposal sync workspace id must be a non-empty string')
    }

    this.local = local
    this.workspaceId = workspaceId
    this.remoteProvider =
      typeof remote === 'function' ? remote : () => remote
  }

  async list(): Promise<AiProposal[]> {
    const proposals = await this.local.list()
    return proposals.map(cloneProposal)
  }

  save(proposal: AiProposal): Promise<void> {
    const next = cloneProposal(proposal)
    const operation = this.writeTail
      .catch(() => undefined)
      .then(async () => {
        // A projection failure must not undo the authoritative local write.
        await this.local.save(cloneProposal(next))

        const remote = this.remoteProvider()
        if (!remote) return

        const expectedRevision = await this.ensureProjectionRevision(remote)
        const result = await remote.pushProposalState(
          this.workspaceId,
          cloneProposal(next),
          expectedRevision,
        )
        if (!result.accepted) {
          this.projectionRevision = isRevision(result.revision) ? result.revision : undefined
          throw new ProposalSyncError(this.workspaceId, next.id, expectedRevision, result)
        }

        this.projectionRevision = requireRevision(result.revision, 'push result')
        if (result.duplicate) {
          // The daemon returns the proposal revision for duplicate writes, not
          // necessarily the current workspace cursor.
          const snapshot = await remote.snapshotProposals(this.workspaceId)
          this.projectionRevision = requireRevision(snapshot.revision, 'snapshot')
        }
      })

    // A failed projection write must not poison later local saves or retries.
    this.writeTail = operation.catch(() => undefined)
    return operation
  }

  async flush(): Promise<void> {
    await this.writeTail
  }

  private async ensureProjectionRevision(remote: ProposalSyncRemote): Promise<number> {
    if (this.projectionRemote !== remote) {
      this.projectionRemote = remote
      this.projectionRevision = undefined
    }
    if (this.projectionRevision === undefined) {
      const snapshot = await remote.snapshotProposals(this.workspaceId)
      this.projectionRevision = requireRevision(snapshot.revision, 'snapshot')
    }
    return this.projectionRevision
  }
}

function isOptions(value: unknown): value is RemoteProposalStoreOptions {
  return Boolean(value && typeof value === 'object' && 'workspaceId' in value)
}

function isProposalStore(value: unknown): value is ProposalStore {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ProposalStore).list === 'function' &&
      typeof (value as ProposalStore).save === 'function',
  )
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function requireRevision(value: unknown, source: string): number {
  if (!isRevision(value)) throw new Error(`Proposal sync ${source} revision is invalid`)
  return value
}

function cloneProposal(proposal: AiProposal): AiProposal {
  return {
    ...proposal,
    patches: proposal.patches.map((patch) => ({ ...patch })),
    inversePatches: proposal.inversePatches?.map((patch) => ({ ...patch })),
  }
}

export {
  ProposalSyncError as ProposalRemoteSyncError,
  ProposalSyncError as ProposalSyncConflictError,
  ProposalSyncError as RemoteProposalSyncError,
}
