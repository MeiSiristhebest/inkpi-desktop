import { describe, expect, it } from 'vitest'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  upsertEntity,
  type StoryState,
  withStoryRevision,
} from '../domain/story'
import { IndexedDbDomainChangeStore } from './indexedDbDomainChangeStore'
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
    const changes = await new IndexedDbDomainChangeStore().list(workspaceId)
    expect(changes.map((changeSet) => changeSet.changes[0].operation)).toEqual(['upsert', 'delete'])
  })

  it('writes StoryState changes to the authoritative log and deduplicates identical saves', async () => {
    const store = new IndexedDbStoryStateStore()
    const workspaceId = `story-state-log-${crypto.randomUUID()}`
    const initial = createStoryState()
    const next = withStoryRevision(initial, 1)

    await store.save(workspaceId, initial)
    await store.save(workspaceId, initial)
    await store.save(workspaceId, next)

    const changeSets = await new IndexedDbDomainChangeStore().list(workspaceId)
    expect(changeSets).toHaveLength(2)
    expect(changeSets.map((changeSet) => changeSet.revision)).toEqual([1, 2])
    expect(changeSets[0].changes[0]).toMatchObject({
      aggregateType: 'story-state',
      aggregateId: workspaceId,
      operation: 'upsert',
      revision: 0,
      payload: initial,
    })
    expect(changeSets[1].changes[0]).toMatchObject({
      aggregateType: 'story-state',
      operation: 'upsert',
      revision: 1,
      payload: next,
    })
  })

  it('serializes concurrent saves and rejects a stale StoryState revision', async () => {
    const store = new IndexedDbStoryStateStore()
    const workspaceId = `story-state-concurrency-${crypto.randomUUID()}`
    await store.save(workspaceId, createStoryState())

    const stale = withStoryRevision(createStoryState(), 1)
    const current = withStoryRevision(createStoryState(), 2)
    await expect(
      Promise.all([store.save(workspaceId, current), store.save(workspaceId, stale)]),
    ).rejects.toThrow('revision conflict')
    expect((await store.load(workspaceId))?.revision).toBe(2)
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
