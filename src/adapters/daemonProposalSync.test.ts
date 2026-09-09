import type { ProposalProjectionSnapshot, ProposalSyncPushResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { AiProposal } from '../ai/proposals/proposalLedger'
import type { RpcClient } from '../ports/aiGateway'
import {
  createDaemonProposalSyncRemote,
  proposalToProjectionState,
} from './daemonDomainSyncRemote'

const proposal: AiProposal = {
  id: 'proposal-1',
  taskId: 'task-1',
  documentId: 'chapter-1',
  baseRevision: 4,
  patches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '改' }],
  explanation: '保留作者语气',
  status: 'pending',
  createdAt: 10,
  sourceHash: 'document-hash-4',
}

describe('daemon proposal sync adapter', () => {
  it('encodes AiProposal state and decodes the daemon projection snapshot', async () => {
    const state = proposalToProjectionState(proposal)
    const response: ProposalProjectionSnapshot = {
      workspaceId: 'workspace-1',
      revision: 1,
      proposals: [state],
      hash: 'snapshot-hash',
      updatedAt: 20,
    }
    const request = vi.fn(async <T>(method: string, _params?: unknown): Promise<T> => {
      if (method === 'proposal.sync.push') {
        return {
          accepted: true,
          duplicate: false,
          workspaceId: 'workspace-1',
          proposalId: proposal.id,
          revision: 1,
          stateHash: 'state-hash',
        } as T
      }
      return response as T
    })
    const remote = createDaemonProposalSyncRemote({ request, close: vi.fn() } as unknown as RpcClient)

    await expect(remote.pushProposalState('workspace-1', proposal, 0)).resolves.toMatchObject({
      accepted: true,
      revision: 1,
    })
    await expect(remote.snapshotProposals('workspace-1')).resolves.toEqual({
      ...response,
      proposals: [proposal],
    })

    expect(request).toHaveBeenNthCalledWith(1, 'proposal.sync.push', {
      workspaceId: 'workspace-1',
      expectedRevision: 0,
      proposal: state,
      stateHash: expect.any(String),
    })
    expect(request).toHaveBeenNthCalledWith(2, 'proposal.sync.snapshot', { workspaceId: 'workspace-1' })
  })

  it('preserves a revision conflict result for the review caller', async () => {
    const request = vi.fn(async <T>(method: string): Promise<T> => {
      if (method !== 'proposal.sync.push') throw new Error(`Unexpected RPC method: ${method}`)
      return {
        accepted: false,
        duplicate: false,
        workspaceId: 'workspace-1',
        proposalId: proposal.id,
        revision: 3,
        stateHash: 'new-state-hash',
        reason: 'revision-conflict',
        currentHash: 'current-snapshot-hash',
      } as ProposalSyncPushResult as T
    })
    const remote = createDaemonProposalSyncRemote({ request, close: vi.fn() } as unknown as RpcClient)

    await expect(remote.pushProposalState('workspace-1', proposal, 2)).resolves.toMatchObject({
      accepted: false,
      reason: 'revision-conflict',
      revision: 3,
      currentHash: 'current-snapshot-hash',
    })
  })
})
