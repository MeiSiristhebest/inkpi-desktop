import type { Provenance } from './provenance'

export interface StoryScene {
  id: string
  title?: string
  documentId?: string
  blockIds: string[]
  order?: number
  entityIds: string[]
  eventIds: string[]
  summary?: string
  provenance: Provenance
}

export function createStoryScene(
  input: Omit<StoryScene, 'blockIds' | 'entityIds' | 'eventIds'> & {
    blockIds?: string[]
    entityIds?: string[]
    eventIds?: string[]
  },
): StoryScene {
  return {
    ...input,
    blockIds: [...(input.blockIds || [])],
    entityIds: [...(input.entityIds || [])],
    eventIds: [...(input.eventIds || [])],
  }
}
