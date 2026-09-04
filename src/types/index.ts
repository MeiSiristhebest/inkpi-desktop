// 底层实体类型定义：volumes（分卷）与 chapters（章节）
// 仅描述存储所需的字段，关联到具体 projectId / volumeId。

export interface ProjectRecord {
  id: string
  name: string
  genre?: string
  intro?: string
  cover?: string
  projectType?: 'full' | 'custom' | 'lite' | 'minimal'
  features?: string[]
  createdAt: number
  updatedAt: number
}

export interface VolumeRecord {
  id: string
  projectId: string
  title: string
  order: number
  description?: string
  createdAt: number
  updatedAt: number
}

export type ChapterStatus = 'draft' | 'review' | 'published' | 'archived'

export interface ChapterRecord {
  id: string
  projectId: string
  volumeId: string
  title: string
  content: string
  wordCount: number
  order: number
  /** 章节状态：草稿 / 审阅中 / 已发布 / 已归档 */
  status?: ChapterStatus
  /** CAS 乐观并发控制修订版本号 */
  revision?: number
  createdAt: number
  updatedAt: number
}

export interface FormDataRecord {
  id?: string
  projectId?: string
  tabId: string
  data: Record<string, any>
}

export interface TableRowRecord {
  id: string
  projectId: string
  tabId: string
  order?: number
  data: Record<string, any>
  createdAt?: number
  updatedAt?: number
}

export interface CardRecord {
  id: string
  projectId: string
  tabId: string
  name: string
  order?: number
  data: Record<string, any>
  createdAt?: number
  updatedAt?: number
}

export interface DailyStatRecord {
  key: string
  projectId: string
  date: string
  words: number
}

export * from './plugin'

