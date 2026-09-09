import { describe, expect, it } from 'vitest'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  upsertEntity,
  type StoryState,
} from '../domain/story'
import { IndexedDbStoryStateStore } from './indexedDbStoryStateStore'

describe('IndexedDbStoryStateStore', () => {
  it('round-trips and isolates the authoritative state', async () => {
    const store = new IndexedDbStoryStateStore()
    const workspaceId = `story-state-round-trip-${crypto.randomUUID()}`
    const state = withEntity(createStoryState(3))

    await store.save(workspaceId, state)
    const loaded = await store.load(workspaceId)

    expect(loaded).toEqual(state)
    loaded!.entities.hero.name = 'Changed outside the store'
    expect((await store.load(workspaceId))?.entities.hero.name).toBe('Hero')
  })

  it('returns undefined for a missing workspace and removes saved state', async () => {
    const store = new IndexedDbStoryStateStore()
    const workspaceId = `story-state-remove-${crypto.randomUUID()}`

    expect(await store.load(workspaceId)).toBeUndefined()
    await store.save(workspaceId, createStoryState())
    await store.remove(workspaceId)

    expect(await store.load(workspaceId)).toBeUndefined()
  })

  it('rejects empty workspace ids and invalid states', async () => {
    const store = new IndexedDbStoryStateStore()

    await expect(store.load(' ')).rejects.toThrow('workspace id')
    await expect(store.save('', createStoryState())).rejects.toThrow('workspace id')
    await expect(
      store.save('story-state-invalid', { ...createStoryState(), revision: -1 }),
    ).rejects.toThrow('revision')
  })
})

function withEntity(state: StoryState): StoryState {
  return upsertEntity(
    state,
    createStoryEntity({
      id: 'hero',
      kind: 'character',
      name: 'Hero',
      provenance: createProvenance({ sourceType: 'author', factLevel: 'canonical-fact' }),
    }),
  )
}
