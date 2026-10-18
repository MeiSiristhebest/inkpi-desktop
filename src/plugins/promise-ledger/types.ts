// 3P 伏笔与债务账本 (promise-ledger) 领域模型与类型定义

import type { Provenance } from '../../domain/story/provenance'

export type PromiseStatus = 'planted' | 'progressing' | 'paid_off' | 'abandoned'
export type PromiseTier = 'main_plot' | 'romance' | 'power_system' | 'side_arc' | 'atmosphere'

export interface ProgressEntry {
  chapter: number
  note: string
  memoryBoost?: number // Legacy annotation, retained when importing old records.
  timestamp?: number
}

export interface PromiseLedgerEntry {
  id: string
  projectId: string
  clueName: string
  tier: PromiseTier
  plantChapter: number // 作品内从 1 开始的章号；0 表示未指定
  plantNote: string
  dueChapterLimit: number // 硬红线（距埋设章节的跨度）；0 表示未设置
  softDeadline: number // 软警告线（距埋设章节的跨度）；0 表示未设置
  status: PromiseStatus
  memoryDecayLambda?: number // Legacy uncalibrated parameter; not used to assess readers.
  progressHistory: ProgressEntry[]
  payoffChapter?: number
  payoffNote?: string
  relatedEntityIds: string[]
  relatedChapterIds: string[]
  createdAt: number
  updatedAt: number
  provenance?: Provenance
}

export interface DebtSnapshot {
  entry: PromiseLedgerEntry
  elapsedChapters: number | null
  isOverdue: boolean
  isWarning: boolean
  isDue: boolean
  deadlineChapter: number | null
  remainingChapters: number | null
  lastProgressChapter: number | null
}

export interface PayoffCandidate {
  entryId: string
  clueName: string
  matchedKeyword: string
  snippet: string
  startOffset: number
  endOffset: number
  status: 'mention'
}
