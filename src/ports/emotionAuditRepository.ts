export interface EmotionVector {
  tension: number // 紧张度 0 - 100
  catharsis: number // 释放/爽感 0 - 100
  frustration: number // 压抑/受挫 0 - 100
  anticipation: number // 期待/悬念 0 - 100
  sorrow: number // 悲伤/遗憾 0 - 100
  joy: number // 喜悦/昂扬 0 - 100
}

export interface EmotionAuditRecord {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  wordCount: number
  vector: EmotionVector
  netPolarity: number // -100 到 +100
  dominantEmotion: 'tension' | 'catharsis' | 'frustration' | 'anticipation' | 'sorrow' | 'joy'
  resonanceScore: number // 0 - 100 读者代入共鸣深度
  warnings: string[]
  suggestions: string[]
  updatedAt: number
}

export interface EmotionAuditRepository {
  getAll(projectId: string): Promise<EmotionAuditRecord[]>
  getByChapterId(chapterId: string): Promise<EmotionAuditRecord | undefined>
  save(record: EmotionAuditRecord): Promise<void>
  delete(id: string): Promise<void>
}
