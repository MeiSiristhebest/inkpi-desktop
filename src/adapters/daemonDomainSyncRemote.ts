import type {
  DomainChangeSet,
  DomainProjectionApplyResult,
  DomainProjectionSnapshot,
  ProposalProjectionSnapshot,
  ProposalProjectionState,
  ProposalSyncPushResult,
} from '@inkpi/protocol'
import {
  calculateProposalProjectionStateHash,
  validateProposalProjectionState,
} from '@inkpi/protocol'
import {
  aiProposalToDomainProposal,
  domainProposalToAiProposal,
} from '../ai/proposals/domainProposal'
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
  const domainProposal = aiProposalToDomainProposal(proposal)
  const state: ProposalProjectionState = {
    ...domainProposal,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt ?? proposal.createdAt,
    ...(proposal.inversePatches === undefined
      ? {}
      : { inversePatch: proposal.inversePatches.map((patch) => ({ ...patch })) }),
    ...(proposal.committedRevision === undefined ? {} : { committedRevision: proposal.committedRevision }),
  }
  validateProposalProjectionState(state)
  return state
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
  validateProposalProjectionState(state)
  return domainProposalToAiProposal(state, {
    status: state.status,
    createdAt: state.createdAt,
    ...(state.updatedAt === state.createdAt ? {} : { updatedAt: state.updatedAt }),
    ...(state.inversePatch === undefined ? {} : { inversePatch: state.inversePatch }),
    ...(state.committedRevision === undefined ? {} : { committedRevision: state.committedRevision }),
  })
}
