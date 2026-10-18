import type { PersonaType, SimulatedComment } from '../../ports/readerSimulationRepository'

export type { PersonaType, SimulatedComment }

export interface ChapterSimulationResult {
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  sourceRevision?: number
  comments: SimulatedComment[]
  toxicAlerts: string[]
  suggestions: string[]
}
