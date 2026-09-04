export interface MultiverseNode {
  chapterIndex: number
  chapterTitle: string
  eventSummary: string
  divergenceLevel: number // 0.0 ~ 1.0 Jaccard 偏离指数
  butterflyEffects: string[]
}

export interface MultiverseBranchRecord {
  id: string
  projectId: string
  name: string
  forkChapterIndex: number
  divergencePremise: string // 如 "如果主角在第15章没有救下女配"
  nodes: MultiverseNode[]
  createdAt: number
}

export interface MultiverseRepository {
  getAll(projectId: string): Promise<MultiverseBranchRecord[]>
  get(id: string): Promise<MultiverseBranchRecord | undefined>
  save(record: MultiverseBranchRecord): Promise<void>
  delete(id: string): Promise<void>
}

