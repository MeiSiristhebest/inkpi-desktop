import type { Provenance } from './provenance'

export interface StoryRelation {
  id: string
  sourceEntityId: string
  targetEntityId: string
  type: string
  attributes: Record<string, unknown>
  provenance: Provenance
}

export function createStoryRelation(
  input: Omit<StoryRelation, 'attributes'> & {
    attributes?: Record<string, unknown>
  },
): StoryRelation {
  return {
    ...input,
    attributes: { ...(input.attributes || {}) },
  }
}
