import { RhythmRadarEngine } from '../../plugins/rhythm-radar/engine/RhythmRadarEngine'
import { readerHookEngine } from '../../plugins/reader-hook/engine/ReaderHookEngine'
import { PaywallSentryEngine } from '../../plugins/paywall-sentry/engine/PaywallSentryEngine'
import { pluginEventBus } from '../../core/pluginEventBus'

export interface ChapterQualityScoreResult {
  chapterId: string
  compositeScore: number // 0 ~ 100
  pacingRating: string
  hookTension: number
  paywallPotentialIndex: number
  summaryAdvice: string[]
}

/**
 * 章节质量综合评估器
 * 统一收束 rhythm-radar（张力节奏）、reader-hook（悬念留钩）与 paywall-sentry（卡点转化）三大算法
 */
export class ChapterQualityEvaluator {
  public static evaluateChapter(params: {
    projectId: string
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    content: string
  }): ChapterQualityScoreResult {
    const { projectId, chapterId, chapterTitle, chapterOrder, content } = params

    // 1. 张力与节奏 (rhythm-radar)
    const rhythmRes = RhythmRadarEngine.analyzeChapter(content, chapterId, chapterOrder)

    // 2. 悬念钩子 (reader-hook)
    const hookRes = readerHookEngine.analyzeEnding(content)

    // 3. 付费卡点势能 (paywall-sentry)
    const paywallRes = PaywallSentryEngine.analyzeChapter({
      chapterId,
      chapterTitle,
      chapterOrder,
      content,
    })

    // 综合打分：张力 35% + 悬念 35% + 卡点势能 30%
    const compositeScore = Math.round(
      0.35 * (rhythmRes.tensionScore * 100) +
      0.35 * hookRes.tensionScore +
      0.30 * paywallRes.ppiScore
    )

    const summaryAdvice: string[] = [
      ...paywallRes.suggestions.slice(0, 2),
      ...hookRes.suggestions.slice(0, 1),
    ]

    // 广播统一评估事件
    pluginEventBus.emit('UNIFIED_CHAPTER_EVALUATED', {
      projectId,
      chapterId,
      compositeScore,
      pacingRating: rhythmRes.pacingStatus,
      cliffhangerScore: paywallRes.cliffhangerScore,
    })

    return {
      chapterId,
      compositeScore: Math.max(0, Math.min(100, compositeScore)),
      pacingRating: rhythmRes.pacingStatus,
      hookTension: hookRes.tensionScore,
      paywallPotentialIndex: paywallRes.ppiScore,
      summaryAdvice,
    }
  }
}
