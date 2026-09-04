// 3P 伏笔与债务账本 (promise-ledger) 领域模型与类型定义

export type PromiseStatus = 'planted' | 'progressing' | 'paid_off' | 'abandoned'
export type PromiseTier = 'main_plot' | 'romance' | 'power_system' | 'side_arc' | 'atmosphere'

export interface ProgressEntry {
  chapter: number
  note: string
  memoryBoost: number // 0 ~ 1 之间，恢复读者记忆热度
  timestamp?: number
}

export interface PromiseLedgerEntry {
  id: string
  projectId: string
  clueName: string
  tier: PromiseTier
  plantChapter: number
  plantNote: string
  dueChapterLimit: number // 硬红线（距埋设章节的跨度）
  softDeadline: number // 软警告线（距埋设章节的跨度）
  status: PromiseStatus
  memoryDecayLambda: number // 遗忘指数衰减常数，默认 0.05
  progressHistory: ProgressEntry[]
  payoffChapter?: number
  payoffNote?: string
  relatedEntityIds: string[]
  relatedChapterIds: string[]
  createdAt: number
  updatedAt: number
}

export interface DebtSnapshot {
  entry: PromiseLedgerEntry
  elapsedChapters: number
  isOverdue: boolean
  isWarning: boolean
  memoryHeat: number // 0.0 ~ 1.0
  urgencyScore: number
}

export interface PayoffCandidate {
  entryId: string
  clueName: string
  matchedKeyword: string
  confidence: number
}
