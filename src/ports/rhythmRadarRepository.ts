export type CliffhangerType = "life_and_death" | "info_twist" | "emotional_climax" | "world_shatter"
export type PacingStatus = "dragged" | "optimal" | "fatiguing"

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
  chapterOrder: number
  tensionScore: number // 0.0 ~ 1.0
  pacingStatus: PacingStatus
  cliffhanger: CliffhangerSuggestion
  actionDensity: number
  sentimentValence: number
  generatedAt: number
}

export interface RhythmRadarRepository {
  getAll(projectId: string): Promise<RhythmRadarReportRecord[]>
  getByChapter(chapterId: string): Promise<RhythmRadarReportRecord | undefined>
  get(id: string): Promise<RhythmRadarReportRecord | undefined>
  save(record: RhythmRadarReportRecord): Promise<void>
  delete(id: string): Promise<void>
}
