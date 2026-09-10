import type { Provenance } from './provenance'

export interface StoryEntity {
  id: string
  kind: string
  name: string
  aliases: string[]
  attributes: Record<string, unknown>
  status?: string
  provenance: Provenance
}

export function createStoryEntity(
  input: Omit<StoryEntity, 'aliases' | 'attributes'> & {
    aliases?: string[]
    attributes?: Record<string, unknown>
  },
): StoryEntity {
  return {
    ...input,
    aliases: [...(input.aliases || [])],
    attributes: { ...(input.attributes || {}) },
  }
}
