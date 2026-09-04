export interface WaterBloatItem {
  type: 'recap' | 'phantom' | 'modifier' | 'banter'
  text: string
  reason: string
}

export interface WaterAuditSnapshot {
  id: string
  projectId: string
  chapterId: string
  waterScore: number
  entropyScore: number
  actionVerbRatio: number
  clicheRatio: number
  totalWordCount: number
  estimatedLeanWordCount: number
  bloatItems: WaterBloatItem[]
  createdAt: number
}

export interface WaterAuditRepository {
  getAll(projectId: string): Promise<WaterAuditSnapshot[]>
  getByChapter(projectId: string, chapterId: string): Promise<WaterAuditSnapshot | undefined>
  save(snapshot: WaterAuditSnapshot): Promise<void>
  delete(id: string): Promise<void>
}
