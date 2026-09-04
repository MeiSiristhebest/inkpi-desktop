export interface ScrapbookFragmentRecord {
  id: string
  projectId: string
  sourceChapterId?: string
  sourceChapterTitle?: string
  snippet: string
  wordCount: number
  deletedAt: number
  tags: string[]
  isReused: boolean
  reusedInChapterId?: string
}

export interface ScrapbookRepository {
  getAll(projectId: string): Promise<ScrapbookFragmentRecord[]>
  get(id: string): Promise<ScrapbookFragmentRecord | undefined>
  save(record: ScrapbookFragmentRecord): Promise<void>
  delete(id: string): Promise<void>
}
