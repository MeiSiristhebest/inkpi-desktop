export type PersonaType = 'toxic_hunter' | 'logic_critic' | 'pleasure_seeker' | 'cp_shipper'

export interface SimulatedComment {
  id: string
  persona: PersonaType
  authorName: string
  targetSnippet: string
  commentText: string
  sentiment: 'praise' | 'criticism' | 'shock' | 'toxic_alert'
  upvotes: number
}

export interface ReaderSimulationRecord {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  toxicityScore: number // 0 - 100
  logicScore: number // 0 - 100
  pleasureScore: number // 0 - 100
  comments: SimulatedComment[]
  toxicAlerts: string[]
  suggestions: string[]
  updatedAt: number
}

export interface ReaderSimulationRepository {
  getAll(projectId: string): Promise<ReaderSimulationRecord[]>
  getByChapterId(chapterId: string): Promise<ReaderSimulationRecord | undefined>
  save(record: ReaderSimulationRecord): Promise<void>
  delete(id: string): Promise<void>
}
