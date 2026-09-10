import type { ProposalSyncPushResult, TaskResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { ProposalSyncRemote } from '../../adapters/daemonDomainSyncRemote'
import {
  attachProposalSyncRemote,
  getProposalSyncRemote,
  isProposalSyncError,
  ProposalSyncError,
  RemoteProposalStore,
} from './remoteProposalStore'
import type { AiProposal, ProposalStore } from './proposalLedger'

const localProposal: AiProposal = {
  id: 'proposal-remote-store',
  taskId: 'task-remote-store',
  documentId: 'chapter-1',
  baseRevision: 4,
  patches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '改' }],
  status: 'pending',
  createdAt: 10,
}

class MemoryProposalStore implements ProposalStore {
  readonly values = new Map<string, AiProposal>()

  async list(): Promise<AiProposal[]> {
    return [...this.values.values()]
  }

  async save(proposal: AiProposal): Promise<void> {
    this.values.set(proposal.id, proposal)
  }
}

function snapshot(revision: number) {
  return {
    workspaceId: 'workspace-1',
    revision,
    proposals: [],
    hash: `snapshot-${revision}`,
    updatedAt: revision,
  }
}

function acceptedResult(proposal: AiProposal, revision: number): ProposalSyncPushResult {
  return {
    accepted: true,
    duplicate: false,
    workspaceId: 'workspace-1',
    proposalId: proposal.id,
    revision,
    stateHash: `state-${revision}`,
  }
}

describe('RemoteProposalStore', () => {
  it('keeps local proposals authoritative and pushes successive states with the projection cursor', async () => {
    const local = new MemoryProposalStore()
    const snapshotProposals = vi.fn(async () => snapshot(3))
    const pushProposalState = vi.fn(async (_workspaceId: string, proposal: AiProposal, expectedRevision: number) =>
      acceptedResult(proposal, expectedRevision + 1),
    )
    const remote: ProposalSyncRemote = { snapshotProposals, pushProposalState }
    const store = new RemoteProposalStore({ local, remote, workspaceId: 'workspace-1' })

    await store.save(localProposal)
    await store.save({ ...localProposal, status: 'accepted', updatedAt: 11 })

    expect(snapshotProposals).toHaveBeenCalledTimes(1)
    expect(pushProposalState).toHaveBeenNthCalledWith(1, 'workspace-1', localProposal, 3)
    expect(pushProposalState).toHaveBeenNthCalledWith(
      2,
      'workspace-1',
      { ...localProposal, status: 'accepted', updatedAt: 11 },
      4,
    )
    expect(await store.list()).toEqual([
      { ...localProposal, status: 'accepted', updatedAt: 11 },
    ])
  })

  it('does not hydrate authoritative local state from a daemon snapshot', async () => {
    const local = new MemoryProposalStore()
    await local.save(localProposal)
    const remoteProposal = { ...localProposal, id: 'daemon-only-proposal' }
    const remote: ProposalSyncRemote = {
      snapshotProposals: vi.fn(async () => ({ ...snapshot(8), proposals: [remoteProposal] })),
      pushProposalState: vi.fn(async () => acceptedResult(localProposal, 9)),
    }
    const store = new RemoteProposalStore({ local, remote, workspaceId: 'workspace-1' })

    await expect(store.list()).resolves.toEqual([localProposal])
    expect(remote.snapshotProposals).not.toHaveBeenCalled()
  })

  it.each([
    ['revision-conflict' as const, 'PROPOSAL_SYNC_REVISION_CONFLICT' as const],
    ['hash-mismatch' as const, 'PROPOSAL_SYNC_HASH_MISMATCH' as const],
  ])('preserves a recognizable %s error after the local write', async (reason, code) => {
    const local = new MemoryProposalStore()
    const remote: ProposalSyncRemote = {
      snapshotProposals: vi.fn(async () => snapshot(2)),
      pushProposalState: vi.fn(async (): Promise<ProposalSyncPushResult> => ({
        accepted: false,
        duplicate: false,
        workspaceId: 'workspace-1',
        proposalId: localProposal.id,
        revision: 7,
        stateHash: 'calculated-state-hash',
        reason,
        currentHash: 'current-snapshot-hash',
      })),
    }
    const store = new RemoteProposalStore({ local, remote, workspaceId: 'workspace-1' })

    const error = await store.save(localProposal).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ProposalSyncError)
    expect(isProposalSyncError(error)).toBe(true)
    expect(error).toMatchObject({
      code,
      reason,
      expectedRevision: 2,
      actualRevision: 7,
      currentHash: 'current-snapshot-hash',
    })
    expect(await store.list()).toEqual([localProposal])
  })

  it('falls back to local persistence when no remote is available', async () => {
    const local = new MemoryProposalStore()
    const snapshotProposals = vi.fn()
    const pushProposalState = vi.fn()
    const store = new RemoteProposalStore({
      local,
      workspaceId: 'workspace-1',
      remote: () => undefined,
    })

    await store.save(localProposal)

    expect(await store.list()).toEqual([localProposal])
    expect(snapshotProposals).not.toHaveBeenCalled()
    expect(pushProposalState).not.toHaveBeenCalled()
  })

  it('associates a daemon remote with a task result without changing the wire result', () => {
    const result: TaskResult = {
      taskId: 'task-remote-association',
      kind: 'creative.rewrite',
      status: 'completed',
    }
    const remote = {
      snapshotProposals: vi.fn(),
      pushProposalState: vi.fn(),
    } as unknown as ProposalSyncRemote

    expect(attachProposalSyncRemote(result, remote)).toBe(result)
    expect(getProposalSyncRemote(result)).toBe(remote)
    expect(getProposalSyncRemote(null)).toBeUndefined()
  })
})
