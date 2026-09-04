export interface GoldChapterEvalRecord {
  id: string
  projectId: string
  score: number // 0 ~ 100
  isQualified: boolean
  motiveScore: number
  goldFingerScore: number
  conflictScore: number
  expectationScore: number
  keyDiagnosis: string[]
  suggestions: string[]
  evaluatedAt: number
}

export interface GoldChaptersRepository {
  getAll(projectId: string): Promise<GoldChapterEvalRecord[]>
  get(id: string): Promise<GoldChapterEvalRecord | undefined>
  save(record: GoldChapterEvalRecord): Promise<void>
  delete(id: string): Promise<void>
}
