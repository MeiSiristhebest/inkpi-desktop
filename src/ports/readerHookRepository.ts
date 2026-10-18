export type ReaderHookType =
  'unclassified' | 'question' | 'anomaly' | 'crisis' | 'battle_cut' | 'epiphany' | 'countdown'

export interface ReaderHookRecord {
  id: string
  projectId: string
  chapterId?: string
  chapterNumber?: number
  hookText: string
  hookType: ReaderHookType
  tensionScore?: number
  authorIntent?: string
  sourceRevision?: number
  observations?: import('../domain/endingReview').EndingObservation[]
  coverage?: { start: number; end: number; total: number }
  analysisAdvice?: string
  createdAt: number
  updatedAt: number
}

export interface ReaderHookRepository {
  getAll(projectId?: string): Promise<ReaderHookRecord[]>
  save(record: ReaderHookRecord): Promise<void>
  delete(id: string): Promise<void>
}
