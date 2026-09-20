import { describe, expect, it } from 'vitest'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  removeEntity,
  upsertEntity,
  withStoryRevision,
  type StoryState,
} from '../../domain/story'
import type { StoryStateStore } from '../../ports/storyStateStore'
import {
  DomainProposalConflictError,
  DomainProposalLedger,
  InMemoryDomainProposalStore,
  type DomainProposalApplyContext,
} from './domainProposalLedger'

describe('DomainProposalLedger', () => {
  it('completes review, CAS commit, and undo against authoritative StoryState', async () => {
    const workspaceId = 'domain-proposal-workspace'
    const story = new MemoryStoryStateStore(createStoryState())
    const ledger = new DomainProposalLedger({
      workspaceId,
      storyStateStore: story,
      store: new InMemoryDomainProposalStore(),
      now: () => 10,
      apply: applyEntityProposal,
    })

    const created = ledger.create({
      id: 'proposal-1',
      taskId: 'task-1',
      baseRevision: 0,
      target: { type: 'entity', id: 'hero' },
      operation: 'create',
      patch: { name: 'Hero' },
    })
    expect(created.status).toBe('pending')
    expect(ledger.accept(created.id).status).toBe('accepted')

    const receipt = await ledger.commit(created.id)
    expect(receipt.revision).toBe(1)
    expect(ledger.get(created.id)).toMatchObject({ status: 'committed', committedRevision: 1 })
    expect((await story.load(workspaceId))?.entities.hero.name).toBe('Hero')

    const undoReceipt = await ledger.undo(created.id)
    expect(undoReceipt.revision).toBe(2)
    expect(ledger.get(created.id)?.status).toBe('undone')
    expect((await story.load(workspaceId))?.entities.hero).toBeUndefined()
  })

  it('marks a proposal stale on a CAS miss and allows a safe rebase', async () => {
    const workspaceId = 'domain-proposal-stale-workspace'
    const story = new MemoryStoryStateStore(createStoryState())
    const ledger = new DomainProposalLedger({
      workspaceId,
      storyStateStore: story,
      now: () => 20,
      apply: applyEntityProposal,
    })
    ledger.create({
      id: 'proposal-stale',
      taskId: 'task-stale',
      baseRevision: 0,
      target: { type: 'entity', id: 'hero' },
      operation: 'create',
      patch: { name: 'Hero' },
    })
    ledger.accept('proposal-stale')
    await story.save(workspaceId, withStoryRevision(createStoryState(), 1))

    await expect(ledger.commit('proposal-stale')).rejects.toBeInstanceOf(
      DomainProposalConflictError,
    )
    expect(ledger.get('proposal-stale')).toMatchObject({
      status: 'stale',
      conflict: { expectedRevision: 0, actualRevision: 1 },
    })

    ledger.rebase('proposal-stale', 1)
    ledger.accept('proposal-stale')
    await expect(ledger.commit('proposal-stale')).resolves.toMatchObject({ revision: 2 })
  })
})

async function applyEntityProposal(
  context: DomainProposalApplyContext,
): Promise<{ state: StoryState; inversePatch: unknown }> {
  const patch = context.proposal.patch as { name?: string; remove?: boolean }
  if (context.undo || patch.remove) {
    return {
      state: withStoryRevision(
        removeEntity(context.currentState, context.proposal.target.id),
        context.nextRevision,
      ),
      inversePatch: { name: 'Hero' },
    }
  }
  return {
    state: withStoryRevision(
      upsertEntity(
        context.currentState,
        createStoryEntity({
          id: context.proposal.target.id,
          kind: 'character',
          name: patch.name ?? 'Unnamed',
          provenance: createProvenance({ sourceType: 'ai-proposed', factLevel: 'proposal' }),
        }),
      ),
      context.nextRevision,
    ),
    inversePatch: { remove: true },
  }
}

class MemoryStoryStateStore implements StoryStateStore {
  private state: StoryState

  constructor(state: StoryState) {
    this.state = structuredClone(state)
  }

  async load(_workspaceId: string): Promise<StoryState> {
    return structuredClone(this.state)
  }

  async save(_workspaceId: string, state: StoryState): Promise<void> {
    if (state.revision <= this.state.revision) throw new Error('revision conflict')
    this.state = structuredClone(state)
  }

  async remove(_workspaceId: string): Promise<void> {
    this.state = createStoryState()
  }
}
