export interface WaterBloatItem {
  type: 'recap' | 'phantom' | 'modifier' | 'banter'
  text: string
  reason: string
  start?: number
  end?: number
}

export interface WaterAuditSnapshot {
  id: string
  projectId: string
  chapterId: string
  /** Retained only on legacy snapshots; not a calibrated literary quality measure. */
  waterScore?: number
  entropyScore: number
  actionVerbRatio: number
  clicheRatio: number
  totalWordCount: number
  estimatedLeanWordCount?: number
  matchedCharacters?: number
  bloatItems: WaterBloatItem[]
  createdAt: number
}

export interface WaterAuditRepository {
  getAll(projectId: string): Promise<WaterAuditSnapshot[]>
  getByChapter(projectId: string, chapterId: string): Promise<WaterAuditSnapshot | undefined>
  save(snapshot: WaterAuditSnapshot): Promise<void>
  delete(id: string): Promise<void>
}
