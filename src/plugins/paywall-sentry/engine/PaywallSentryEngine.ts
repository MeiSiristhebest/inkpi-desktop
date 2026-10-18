import type { PaywallAuditResult } from '../types'
import { reviewEnding } from '../../../domain/endingReview'
export class PaywallSentryEngine {
  static analyzeChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number | null
    content: string
  }): PaywallAuditResult {
    const ending = reviewEnding(params.content)
    return {
      chapterId: params.chapterId,
      chapterTitle: params.chapterTitle,
      chapterOrder: params.chapterOrder,
      wordCount: ending.characters,
      ending,
    }
  }
  static observedConversion(counts: { reached: number; paid: number }) {
    const { reached, paid } = counts
    if (
      !Number.isSafeInteger(reached) ||
      !Number.isSafeInteger(paid) ||
      reached < 0 ||
      paid < 0 ||
      paid > reached
    )
      throw new Error('观察人数和付费人数须为非负整数，付费人数不能超过观察人数。')
    return { reached, paid, rate: reached > 0 ? paid / reached : null }
  }
}
