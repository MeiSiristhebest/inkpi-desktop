import type { PersonaType, SimulatedComment } from '../../ports/readerSimulationRepository'

export type { PersonaType, SimulatedComment }

export interface ChapterSimulationResult {
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  toxicityScore: number // 0 - 100 越低越安全
  logicScore: number // 0 - 100 越高越严密
  pleasureScore: number // 0 - 100 爽点推图分
  comments: SimulatedComment[]
  toxicAlerts: string[]
  suggestions: string[]
}
