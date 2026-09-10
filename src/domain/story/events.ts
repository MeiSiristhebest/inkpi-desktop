import type { Provenance } from './provenance'

export interface StoryEvent {
  id: string
  type: string
  title?: string
  occurredAt?: string | number
  sceneId?: string
  entityIds: string[]
  attributes: Record<string, unknown>
  provenance: Provenance
}

export function createStoryEvent(
  input: Omit<StoryEvent, 'entityIds' | 'attributes'> & {
    entityIds?: string[]
    attributes?: Record<string, unknown>
  },
): StoryEvent {
  return {
    ...input,
    entityIds: [...(input.entityIds || [])],
    attributes: { ...(input.attributes || {}) },
  }
}
