export type PersonaType = 'toxic_hunter' | 'logic_critic' | 'pleasure_seeker' | 'cp_shipper'

export interface SimulatedComment {
  id: string
  persona: PersonaType
  authorName: string
  targetSnippet: string
  commentText: string
  sentiment: 'praise' | 'criticism' | 'shock' | 'toxic_alert' | 'review_question'
  /** Legacy simulated votes are retained when loading old records; new observations have none. */
  upvotes?: number
  sourceStart?: number
  sourceEnd?: number
}

export interface ReaderSimulationRecord {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  /** Revision of the saved chapter used to generate these questions, when known. */
  sourceRevision?: number
  /** Legacy uncalibrated values; new records contain questions and source spans. */
  toxicityScore?: number
  logicScore?: number
  pleasureScore?: number
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
