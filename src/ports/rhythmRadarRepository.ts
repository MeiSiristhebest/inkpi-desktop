export type CliffhangerType = 'life_and_death' | 'info_twist' | 'emotional_climax' | 'world_shatter'
export type PacingStatus = 'dragged' | 'optimal' | 'fatiguing'

export interface CliffhangerSuggestion {
  type: CliffhangerType
  recommendedCutSnippet: string
  hookPrompt: string
  punchline: string
}

export interface RhythmRadarReportRecord {
  id: string
  projectId: string
  chapterId: string
  chapterOrder: number | null
  tensionScore?: number // 0.0 ~ 1.0
  pacingStatus?: PacingStatus
  cliffhanger?: CliffhangerSuggestion
  actionDensity?: number
  sentimentValence?: number
  sourceText?: string
  observations?: import('../domain/endingReview').EndingObservation[]
  cut?: import('../domain/endingReview').CutAlternative
  generatedAt: number
}

export interface RhythmRadarRepository {
  getAll(projectId: string): Promise<RhythmRadarReportRecord[]>
  getByChapter(chapterId: string): Promise<RhythmRadarReportRecord | undefined>
  get(id: string): Promise<RhythmRadarReportRecord | undefined>
  save(record: RhythmRadarReportRecord): Promise<void>
  delete(id: string): Promise<void>
}
