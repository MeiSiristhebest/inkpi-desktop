// 底层实体类型定义：volumes（分卷）与 chapters（章节）
// 仅描述存储所需的字段，关联到具体 projectId / volumeId。

export interface VolumeRecord {
  id: string
  projectId: string
  title: string
  order: number
  description?: string
  createdAt: number
  updatedAt: number
}

export interface ChapterRecord {
  id: string
  projectId: string
  volumeId: string
  title: string
  content: string
  wordCount: number
  order: number
  createdAt: number
  updatedAt: number
}

export * from './plugin'
