import type { ChapterRecord } from '../types'

export type ChapterMutationOrigin =
  | 'user-typing'
  | 'paste'
  | 'ai-rewrite'
  | 'plugin'
  | 'format'
  | 'sensitive-replace'
  | 'history-restore'
  | 'ghost-accept'
  | 'title-edit'
  | 'import'

export interface ChapterContentReplaceMutation {
  type: 'replace-content'
  content: string
}

export interface ChapterRangePatchMutation {
  type: 'patch-range'
  from: number
  to: number
  content: string
}

export interface ChapterTitleEditMutation {
  type: 'update-title'
  title: string
}

export type ChapterMutation =
  ChapterContentReplaceMutation | ChapterRangePatchMutation | ChapterTitleEditMutation

export interface ChapterMutationCommand {
  workspaceId: string
  chapterId: string
  /** Optional in-memory active chapter fallback when testing or transitioning */
  activeChapterFallback?: ChapterRecord
  /** If supplied, enforce optimistic concurrency check (CAS) against current stored revision */
  expectedRevision?: number
  mutation: ChapterMutation
  origin: ChapterMutationOrigin
  /** Whether to count delta into daily author writing stats (defaults to false for AI/import) */
  countAsAuthorWriting?: boolean
  /** Whether to trigger an automatic snapshot in history/milestone */
  createHistorySnapshot?: boolean
  /** Whether to signal downstream continuity auditors */
  triggerContinuityAudit?: boolean
}

export interface ChapterMutationSuccess {
  success: true
  conflict: false
  previousRevision: number
  newRevision: number
  chapter: ChapterRecord
  wordCountDelta: number
}

export interface ChapterMutationConflict {
  success: false
  conflict: true
  currentRevision: number
  error: string
}

export interface ChapterMutationFailure {
  success: false
  conflict: false
  currentRevision?: number
  error: string
}

export type ChapterMutationExecutionResult =
  ChapterMutationSuccess | ChapterMutationConflict | ChapterMutationFailure

export interface ChapterMutationService {
  mutate(command: ChapterMutationCommand): Promise<ChapterMutationExecutionResult>
}
