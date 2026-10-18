import type { ReaderHookRecord, ReaderHookType } from '../../ports/readerHookRepository'
import type { EndingReview } from '../../domain/endingReview'
export type { ReaderHookRecord, ReaderHookType }
export interface HookAnalysisResult extends EndingReview {
  hookType: 'unclassified'
  feedback: string
}
export interface HookTemplate {
  id: string
  type: ReaderHookType
  name: string
  description: string
  example: string
}
