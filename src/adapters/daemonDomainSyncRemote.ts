import type {
  DomainChangeSet,
  DomainProjectionApplyResult,
  DomainProjectionSnapshot,
  ProposalProjectionSnapshot,
  ProposalProjectionState,
  ProposalSyncPushResult,
} from '@inkpi/protocol'
import { calculateProposalProjectionStateHash } from '@inkpi/protocol'
import type { AiProposal, TextPatch } from '../ai/proposals/proposalLedger'
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

export interface DesktopProposalProjectionSnapshot
  extends Omit<ProposalProjectionSnapshot, 'proposals'> {
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
  return {
    id: proposal.id,
    taskId: proposal.taskId,
    baseRevision: proposal.baseRevision,
    target: { type: 'document', id: proposal.documentId },
    operation: 'update',
    patch: proposal.patches.map(cloneTextPatch),
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt ?? proposal.createdAt,
    ...(proposal.sourceHash === undefined ? {} : { sourceHash: proposal.sourceHash }),
    ...(proposal.explanation === undefined ? {} : { reason: proposal.explanation }),
    ...(proposal.inversePatches === undefined
      ? {}
      : { inversePatch: proposal.inversePatches.map(cloneTextPatch) }),
    ...(proposal.committedRevision === undefined ? {} : { committedRevision: proposal.committedRevision }),
  }
}

/** Creates the JSON-RPC adapter without changing the local ProposalLedger. */
export function createDaemonProposalSyncRemote(client: RpcClient): ProposalSyncRemote {
  return {
    pushProposalState: (workspaceId, proposal, expectedRevision) => {
      const state = proposalToProjectionState(proposal)
      return client.request<ProposalSyncPushResult>('proposal.sync.push', {
        workspaceId,
        expectedRevision,
        proposal: state,
        stateHash: calculateProposalProjectionStateHash(state),
      })
    },
    snapshotProposals: async (workspaceId) => {
      const snapshot = await client.request<ProposalProjectionSnapshot>('proposal.sync.snapshot', { workspaceId })
      return {
        ...snapshot,
        proposals: snapshot.proposals.map(projectionStateToProposal),
      }
    },
  }
}

function projectionStateToProposal(state: ProposalProjectionState): AiProposal {
  if (state.target.type !== 'document') throw new Error('Unsupported proposal projection target')
  return {
    id: state.id,
    taskId: state.taskId,
    documentId: state.target.id,
    baseRevision: state.baseRevision,
    patches: requireTextPatches(state.patch, state.target.id),
    status: state.status,
    createdAt: state.createdAt,
    ...(state.updatedAt === state.createdAt ? {} : { updatedAt: state.updatedAt }),
    ...(state.sourceHash === undefined ? {} : { sourceHash: state.sourceHash }),
    ...(state.reason === undefined ? {} : { explanation: state.reason }),
    ...(state.inversePatch === undefined
      ? {}
      : { inversePatches: requireTextPatches(state.inversePatch, state.target.id) }),
    ...(state.committedRevision === undefined ? {} : { committedRevision: state.committedRevision }),
  }
}

function requireTextPatches(value: unknown, documentId: string): TextPatch[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Proposal projection is missing text patches')
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Proposal projection contains an invalid patch')
    const patch = candidate as Record<string, unknown>
    if (
      !Number.isInteger(patch.from) ||
      !Number.isInteger(patch.to) ||
      (patch.from as number) < 0 ||
      (patch.to as number) < (patch.from as number) ||
      typeof patch.text !== 'string'
    ) {
      throw new Error('Proposal projection contains an invalid text patch')
    }
    return {
      documentId,
      from: patch.from as number,
      to: patch.to as number,
      text: patch.text,
    }
  })
}

function cloneTextPatch(patch: TextPatch): TextPatch {
  return { ...patch }
}
