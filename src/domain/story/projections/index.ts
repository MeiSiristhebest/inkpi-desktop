import type { StoryState } from '../storyState'
import type { StoryEntity } from '../entities'
import type { NarrativePromise } from '../promises'
import type { StoryEvent } from '../events'

export interface StoryProjection {
  revision: number
  entityCount: number
  eventCount: number
  openPromiseCount: number
  entitiesByKind: Record<string, StoryEntity[]>
  eventsByScene: Record<string, StoryEvent[]>
  openPromises: NarrativePromise[]
}

export function projectStoryState(state: StoryState): StoryProjection {
  const entitiesByKind: Record<string, StoryEntity[]> = {}
  for (const entity of Object.values(state.entities)) {
    entitiesByKind[entity.kind] ||= []
    entitiesByKind[entity.kind].push(entity)
  }

  const eventsByScene: Record<string, StoryEvent[]> = {}
  for (const event of Object.values(state.events)) {
    const sceneKey = event.sceneId || 'unassigned'
    eventsByScene[sceneKey] ||= []
    eventsByScene[sceneKey].push(event)
  }

  const openPromises = Object.values(state.promises).filter((item) => item.status === 'open')
  return {
    revision: state.revision,
    entityCount: Object.keys(state.entities).length,
    eventCount: Object.keys(state.events).length,
    openPromiseCount: openPromises.length,
    entitiesByKind,
    eventsByScene,
    openPromises,
  }
}
