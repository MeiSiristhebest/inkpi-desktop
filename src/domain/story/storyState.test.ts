import { describe, expect, it } from 'vitest'
import {
  assertStoryState,
  createNarrativePromise,
  createProvenance,
  createStoryEntity,
  createStoryEvent,
  createStoryState,
  projectStoryState,
  upsertEntity,
  upsertEvent,
  upsertPromise,
  withStoryRevision,
} from './index'

const provenance = createProvenance({
  sourceType: 'author',
  factLevel: 'canonical-fact',
  sourceDocumentId: 'chapter-1',
  confidence: 1,
})

describe('Creative Story Domain', () => {
  it('keeps canonical entities, events, and promises in an immutable state', () => {
    const original = createStoryState()
    const hero = createStoryEntity({
      id: 'character:hero',
      kind: 'character',
      name: 'Hero',
      provenance,
    })
    const event = createStoryEvent({
      id: 'event:arrival',
      type: 'arrival',
      sceneId: 'scene:one',
      entityIds: [hero.id],
      provenance,
    })
    const promise = createNarrativePromise({
      id: 'promise:door',
      statement: 'The locked door will open.',
      status: 'open',
      provenance,
    })

    const next = upsertPromise(upsertEvent(upsertEntity(original, hero), event), promise)

    expect(original.entities).toEqual({})
    expect(next.entities[hero.id]).toEqual(hero)
    expect(next.events[event.id]).toEqual(event)
    expect(next.promises[promise.id]).toEqual(promise)
    expect(projectStoryState(next)).toMatchObject({
      entityCount: 1,
      eventCount: 1,
      openPromiseCount: 1,
    })
  })

  it('requires provenance and validates revisions and collection keys', () => {
    const state = withStoryRevision(createStoryState(), 3)
    expect(state.revision).toBe(3)
    expect(() => assertStoryState(state)).not.toThrow()
    expect(() => withStoryRevision(state, -1)).toThrow(RangeError)

    const invalid = {
      ...state,
      entities: {
        wrong: {
          id: 'right',
          kind: 'character',
          name: 'Broken',
          aliases: [],
          attributes: {},
          provenance,
        },
      },
    }
    expect(() => assertStoryState(invalid)).toThrow(/does not match/)
  })
})
