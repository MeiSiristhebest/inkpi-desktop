export type ReaderHookType =
  | 'question'
  | 'anomaly'
  | 'crisis'
  | 'battle_cut'
  | 'epiphany'
  | 'countdown'

export interface ReaderHookRecord {
  id: string
  projectId: string
  chapterId?: string
  chapterNumber?: number
  hookText: string
  hookType: ReaderHookType
  tensionScore: number
  analysisAdvice?: string
  createdAt: number
  updatedAt: number
}

export interface ReaderHookRepository {
  getAll(): Promise<ReaderHookRecord[]>
  save(record: ReaderHookRecord): Promise<void>
  delete(id: string): Promise<void>
}
