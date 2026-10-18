import type { EndingReview } from '../../domain/endingReview'
export interface PaywallAuditResult {
  chapterId: string
  chapterTitle: string
  chapterOrder: number | null
  wordCount: number
  ending: EndingReview
}
