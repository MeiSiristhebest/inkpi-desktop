import type { Provenance } from './provenance'

export interface TimelineConstraint {
  type: string
  description: string
  eventIds?: string[]
}

export interface StoryTimeline {
  id: string
  label: string
  eventIds: string[]
  constraints: TimelineConstraint[]
  provenance: Provenance
}

export function createStoryTimeline(
  input: Omit<StoryTimeline, 'eventIds' | 'constraints'> & {
    eventIds?: string[]
    constraints?: TimelineConstraint[]
  },
): StoryTimeline {
  return {
    ...input,
    eventIds: [...(input.eventIds || [])],
    constraints: (input.constraints || []).map((constraint) => ({
      ...constraint,
      eventIds: constraint.eventIds ? [...constraint.eventIds] : undefined,
    })),
  }
}
