export interface MultiverseNode {
  chapterIndex: number
  chapterTitle: string
  eventSummary: string
  divergenceLevel: number | null
  butterflyEffects: string[]
  sourceChapterId?: string
  sourceRevision?: number
  canonSummary?: string
  status?: 'inherited' | 'hypothesis' | 'unplanned'
  assumptions?: string[]
  premiseLink?: string
  stateDifferenceMethod?: 'inherited' | 'author-fact-set-jaccard'
}

export interface MultiverseBranchRecord {
  id: string
  projectId: string
  name: string
  forkChapterIndex: number
  divergencePremise: string // 如 "如果主角在第15章没有救下女配"
  nodes: MultiverseNode[]
  createdAt: number
  schemaVersion?: 2
}

export interface MultiverseRepository {
  getAll(projectId: string): Promise<MultiverseBranchRecord[]>
  get(id: string): Promise<MultiverseBranchRecord | undefined>
  save(record: MultiverseBranchRecord): Promise<void>
  delete(id: string): Promise<void>
}
