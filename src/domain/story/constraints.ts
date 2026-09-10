import type { Provenance } from './provenance'

export type StoryConstraintSeverity = 'info' | 'warning' | 'error'

export interface StoryConstraint {
  id: string
  type: string
  description: string
  subjectIds: string[]
  severity: StoryConstraintSeverity
  provenance: Provenance
}

export function createStoryConstraint(
  input: Omit<StoryConstraint, 'subjectIds'> & { subjectIds?: string[] },
): StoryConstraint {
  return {
    ...input,
    subjectIds: [...(input.subjectIds || [])],
  }
}
