import type {
  DomainChangeSet,
  DomainProjectionApplyResult,
  DomainProjectionSnapshot,
  ProposalProjectionSnapshot,
  ProposalProjectionState,
  ProposalSyncPushResult,
} from '@inkpi/protocol'
import {
  calculateProposalProjectionSnapshotHash,
  calculateProposalProjectionStateHash,
  validateProposalProjectionState,
} from '@inkpi/protocol'
import {
  aiProposalToDomainProposal,
  domainProposalToAiProposal,
} from '../ai/proposals/domainProposal'
import {
  type DomainProposalProjectionSnapshot,
  type DomainProposalRecord,
  type DomainProposalSyncRemote,
  validateDomainProposalRecord,
} from '../ai/proposals/domainProposalLedger'
import type { AiProposal } from '../ai/proposals/proposalLedger'
import type { DomainSyncRemote } from '../domain/sync/domainSyncService'
import type { RpcClient } from '../ports/aiGateway'

/** JSON-RPC adapter for the daemon's derived domain projection. */
export function createDaemonDomainSyncRemote(client: RpcClient): DomainSyncRemote {
  return {
    pushDomainChangeSet: (changeSet: DomainChangeSet) =>
      client.request<DomainProjectionApplyResult>('domain.sync.push', { changeSet }),
    pullDomainChangeSets: (workspaceId: string, afterRevision = 0) =>
      client.request<DomainChangeSet[]>('domain.sync.pull', { workspaceId, afterRevision }),
    snapshotDomain: (workspaceId: string) =>
      client.request<DomainProjectionSnapshot>('domain.sync.snapshot', { workspaceId }),
    restoreDomainSnapshot: (snapshot: DomainProjectionSnapshot) =>
      client.request('domain.sync.restore', { snapshot }),
  }
}

export interface DesktopProposalProjectionSnapshot extends Omit<
  ProposalProjectionSnapshot,
  'proposals'
> {
  proposals: AiProposal[]
}

export interface ProposalSyncRemote {
  pushProposalState(
    workspaceId: string,
    proposal: AiProposal,
    expectedRevision: number,
  ): Promise<ProposalSyncPushResult>
  snapshotProposals(workspaceId: string): Promise<DesktopProposalProjectionSnapshot>
}

/** Maps the Desktop review ledger to the domain-neutral Runtime projection. */
export function proposalToProjectionState(proposal: AiProposal): ProposalProjectionState {
  const domainProposal = aiProposalToDomainProposal(proposal)
  const state: ProposalProjectionState = {
    ...domainProposal,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt ?? proposal.createdAt,
    ...(proposal.inversePatches === undefined
      ? {}
      : { inversePatch: proposal.inversePatches.map((patch) => ({ ...patch })) }),
    ...(proposal.committedRevision === undefined
      ? {}
      : { committedRevision: proposal.committedRevision }),
  }
  validateProposalProjectionState(state)
  return state
}

/** Maps the generic Desktop domain-proposal record without applying its patch. */
export function domainProposalRecordToProjectionState(
  proposal: DomainProposalRecord,
): ProposalProjectionState {
  validateDomainProposalRecord(proposal)
  const state: ProposalProjectionState = {
    id: proposal.id,
    taskId: proposal.taskId,
    baseRevision: proposal.baseRevision,
    target: { ...proposal.target },
    operation: proposal.operation,
    ...(proposal.sourceHash === undefined ? {} : { sourceHash: proposal.sourceHash }),
    ...(proposal.patch === undefined ? {} : { patch: cloneJsonValue(proposal.patch) }),
    ...(proposal.evidence === undefined
      ? {}
      : { evidence: proposal.evidence.map((evidence) => ({ ...evidence })) }),
    ...(proposal.reason === undefined ? {} : { reason: proposal.reason }),
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt ?? proposal.createdAt,
    ...(proposal.inversePatch === undefined
      ? {}
      : { inversePatch: cloneJsonValue(proposal.inversePatch) }),
    ...(proposal.committedRevision === undefined
      ? {}
      : { committedRevision: proposal.committedRevision }),
  }
  validateProposalProjectionState(state)
  return state
}

export function projectionStateToDomainProposalRecord(
  state: ProposalProjectionState,
): DomainProposalRecord {
  validateProposalProjectionState(state)
  const record: DomainProposalRecord = {
    id: state.id,
    taskId: state.taskId,
    baseRevision: state.baseRevision,
    target: { ...state.target },
    operation: state.operation,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    ...(state.sourceHash === undefined ? {} : { sourceHash: state.sourceHash }),
    ...(state.patch === undefined ? {} : { patch: cloneJsonValue(state.patch) }),
    ...(state.evidence === undefined
      ? {}
      : { evidence: state.evidence.map((evidence) => ({ ...evidence })) }),
    ...(state.reason === undefined ? {} : { reason: state.reason }),
    ...(state.inversePatch === undefined
      ? {}
      : { inversePatch: cloneJsonValue(state.inversePatch) }),
    ...(state.committedRevision === undefined
      ? {}
      : { committedRevision: state.committedRevision }),
  }
  validateDomainProposalRecord(record)
  return record
}

/** JSON-RPC adapter for generic proposals; the daemon remains projection-only. */
export function createDaemonDomainProposalSyncRemote(client: RpcClient): DomainProposalSyncRemote {
  return {
    pushDomainProposalState: (workspaceId, proposal, expectedRevision) => {
      const state = domainProposalRecordToProjectionState(proposal)
      return client
        .request<unknown>('proposal.sync.push', {
          workspaceId,
          expectedRevision,
          proposal: state,
          stateHash: calculateProposalProjectionStateHash(state),
        })
        .then((result) => {
          assertProposalSyncPushResult(result, workspaceId, proposal.id)
          return result
        })
    },
    snapshotDomainProposals: async (workspaceId) => {
      const snapshot = await client.request<unknown>('proposal.sync.snapshot', { workspaceId })
      assertProposalProjectionSnapshot(snapshot, workspaceId)
      if (calculateProposalProjectionSnapshotHash(snapshot) !== snapshot.hash) {
        throw new Error('Daemon domain proposal snapshot hash mismatch')
      }
      const converted: DomainProposalProjectionSnapshot = {
        ...snapshot,
        proposals: snapshot.proposals.map(projectionStateToDomainProposalRecord),
      }
      return converted
    },
  }
}

/** Creates the JSON-RPC adapter without changing the local ProposalLedger. */
export function createDaemonProposalSyncRemote(client: RpcClient): ProposalSyncRemote {
  return {
    pushProposalState: (workspaceId, proposal, expectedRevision) => {
      const state = proposalToProjectionState(proposal)
      return client
        .request<unknown>('proposal.sync.push', {
          workspaceId,
          expectedRevision,
          proposal: state,
          stateHash: calculateProposalProjectionStateHash(state),
        })
        .then((result) => {
          assertProposalSyncPushResult(result, workspaceId, proposal.id)
          return result
        })
    },
    snapshotProposals: async (workspaceId) => {
      const snapshot = await client.request<unknown>('proposal.sync.snapshot', {
        workspaceId,
      })
      assertProposalProjectionSnapshot(snapshot, workspaceId)
      const proposals = snapshot.proposals.map(projectionStateToProposal)
      if (calculateProposalProjectionSnapshotHash(snapshot) !== snapshot.hash) {
        throw new Error('Daemon proposal snapshot hash mismatch')
      }
      return {
        ...snapshot,
        proposals,
      }
    },
  }
}

function projectionStateToProposal(state: ProposalProjectionState): AiProposal {
  validateProposalProjectionState(state)
  return domainProposalToAiProposal(state, {
    status: state.status,
    createdAt: state.createdAt,
    ...(state.updatedAt === state.createdAt ? {} : { updatedAt: state.updatedAt }),
    ...(state.inversePatch === undefined ? {} : { inversePatch: state.inversePatch }),
    ...(state.committedRevision === undefined
      ? {}
      : { committedRevision: state.committedRevision }),
  })
}

function assertProposalSyncPushResult(
  value: unknown,
  workspaceId: string,
  proposalId: string,
): asserts value is ProposalSyncPushResult {
  if (!isRecord(value)) throw new Error('Daemon proposal push returned an invalid result')
  if (
    typeof value.accepted !== 'boolean' ||
    typeof value.duplicate !== 'boolean' ||
    value.workspaceId !== workspaceId ||
    value.proposalId !== proposalId ||
    !isRevision(value.revision) ||
    typeof value.stateHash !== 'string' ||
    !value.stateHash
  ) {
    throw new Error(`Daemon proposal push returned an invalid result for ${proposalId}`)
  }
  if (
    value.reason !== undefined &&
    value.reason !== 'revision-conflict' &&
    value.reason !== 'hash-mismatch' &&
    value.reason !== 'invalid-proposal'
  ) {
    throw new Error(`Daemon proposal push returned an unknown rejection for ${proposalId}`)
  }
  if (
    value.currentHash !== undefined &&
    (typeof value.currentHash !== 'string' || !value.currentHash)
  ) {
    throw new Error(`Daemon proposal push returned an invalid current hash for ${proposalId}`)
  }
}

function assertProposalProjectionSnapshot(
  value: unknown,
  workspaceId: string,
): asserts value is ProposalProjectionSnapshot {
  if (!isRecord(value)) throw new Error('Daemon proposal snapshot is not an object')
  if (
    value.workspaceId !== workspaceId ||
    !isRevision(value.revision) ||
    !Array.isArray(value.proposals) ||
    typeof value.hash !== 'string' ||
    !value.hash ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    throw new Error('Daemon proposal snapshot has invalid coordinates')
  }
  for (const proposal of value.proposals) validateProposalProjectionState(proposal)
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
