import type { StoryConstraint } from './constraints'
import type { StoryEntity } from './entities'
import type { StoryEvent } from './events'
import type { NarrativePromise } from './promises'
import type { StoryRelation } from './relations'
import type { StoryScene } from './scenes'
import type { StoryTimeline } from './timelines'

export interface StoryState {
  revision: number
  entities: Record<string, StoryEntity>
  relations: Record<string, StoryRelation>
  events: Record<string, StoryEvent>
  scenes: Record<string, StoryScene>
  timelines: Record<string, StoryTimeline>
  promises: Record<string, NarrativePromise>
  constraints: Record<string, StoryConstraint>
}

export function createStoryState(revision = 0): StoryState {
  return {
    revision,
    entities: {},
    relations: {},
    events: {},
    scenes: {},
    timelines: {},
    promises: {},
    constraints: {},
  }
}

export function upsertEntity(state: StoryState, entity: StoryEntity): StoryState {
  return { ...state, entities: { ...state.entities, [entity.id]: entity } }
}

export function upsertRelation(state: StoryState, relation: StoryRelation): StoryState {
  return { ...state, relations: { ...state.relations, [relation.id]: relation } }
}

export function upsertEvent(state: StoryState, event: StoryEvent): StoryState {
  return { ...state, events: { ...state.events, [event.id]: event } }
}

export function upsertScene(state: StoryState, scene: StoryScene): StoryState {
  return { ...state, scenes: { ...state.scenes, [scene.id]: scene } }
}

export function upsertTimeline(state: StoryState, timeline: StoryTimeline): StoryState {
  return { ...state, timelines: { ...state.timelines, [timeline.id]: timeline } }
}

export function upsertPromise(state: StoryState, promise: NarrativePromise): StoryState {
  return { ...state, promises: { ...state.promises, [promise.id]: promise } }
}

export function upsertConstraint(state: StoryState, constraint: StoryConstraint): StoryState {
  return { ...state, constraints: { ...state.constraints, [constraint.id]: constraint } }
}

export function removeEntity(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'entities', id)
}

export function removeRelation(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'relations', id)
}

export function removeEvent(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'events', id)
}

export function removeScene(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'scenes', id)
}

export function removeTimeline(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'timelines', id)
}

export function removePromise(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'promises', id)
}

export function removeConstraint(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'constraints', id)
}

function removeFromCollection(
  state: StoryState,
  collection: Exclude<keyof StoryState, 'revision'>,
  id: string,
): StoryState {
  const next = { ...state[collection] } as Record<string, unknown>
  delete next[id]
  return { ...state, [collection]: next }
}

export function withStoryRevision(state: StoryState, revision: number): StoryState {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new RangeError('Story revision must be a non-negative integer')
  }
  return { ...state, revision }
}

export function assertStoryState(state: StoryState): void {
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    throw new Error('Story state has an invalid revision')
  }
  for (const [collectionName, collection] of Object.entries(state)) {
    if (collectionName === 'revision' || typeof collection !== 'object' || collection === null) {
      continue
    }
    for (const [id, value] of Object.entries(collection)) {
      if (!value || typeof value !== 'object' || !('id' in value) || value.id !== id) {
        throw new Error(`Story ${collectionName} key does not match its entity id: ${id}`)
      }
      if (!('provenance' in value) || !value.provenance) {
        throw new Error(`Story ${collectionName} entry is missing provenance: ${id}`)
      }
    }
  }
}
