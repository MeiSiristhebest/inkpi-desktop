import type {
  ChapterEmotionalScore,
  GoldenThreeDiagnostic,
  ExpectationContract,
  ExpectationObservation,
} from '../types'
import { semanticTextFromContent } from '../../../domain/content'

const SUPPRESSION_CUES = [
  '打压',
  '屈辱',
  '嘲讽',
  '绝境',
  '吐血',
  '危机',
  '围攻',
  '压制',
  '命悬一线',
  '退婚',
  '冷笑',
  '蝼蚁',
  '残废',
  '夺骨',
  '废物',
  '羞辱',
  '重伤',
  '被困',
]

const PAYOFF_CUES = [
  '突破',
  '斩杀',
  '震惊',
  '目瞪口呆',
  '悔恨',
  '暴毙',
  '臣服',
  '奉上',
  '神通大成',
  '打脸',
  '秒杀',
  '骇然',
  '不可思议',
  '狂喜',
  '倒吸一口凉气',
  '横扫',
  '翻盘',
]

const GOLDEN_FINGER_CUES = [
  '系统',
  '造化',
  '金手指',
  '古玉',
  '传承',
  '觉醒',
  '残魂',
  '神尊',
  '至尊骨',
  '重生',
  '异鼎',
  '戒指',
  '识海',
  '重修',
  '至宝',
  '至尊',
]

const HOOK_CUES = [
  '三年之约',
  '大比',
  '宗门',
  '秘境',
  '生死战',
  '黑手',
  '大劫',
  '迷雾',
  '杀父之仇',
  '深渊',
  '未解之谜',
  '誓杀',
  '惊天阴谋',
]

export class ExpectationEngine {
  public static buildAnalysisInput(params: {
    chapters: Array<{ order: number; title: string; content: string }>
  }): Record<string, unknown> {
    return {
      chapters: params.chapters.map((chapter) => ({
        ...chapter,
        content: semanticTextFromContent('expectation-chapter-' + chapter.order, chapter.content),
      })),
      reviewQuestions: [
        'What expectation is explicitly established?',
        'What outcome is still pending?',
        'What changes the reader can identify from the supplied text?',
        'Which author-recorded deadline or state conflicts with the supplied text?',
      ],
      measurementBoundary:
        'Interpretation needs source evidence and context; keyword mentions do not establish conflict, payoff or reader behavior.',
    }
  }

  private locate(
    text: string,
    chapterIndex: number,
    terms: string[],
    category: ExpectationObservation['category'],
  ): ExpectationObservation[] {
    const observations: ExpectationObservation[] = []
    for (const term of new Set(terms)) {
      let from = 0
      while (from < text.length) {
        const startOffset = text.indexOf(term, from)
        if (startOffset < 0) break
        const endOffset = startOffset + term.length
        observations.push({
          chapterIndex,
          category,
          quote: text.slice(startOffset, endOffset),
          startOffset,
          endOffset,
        })
        from = endOffset
      }
    }
    return observations
  }

  public computeTensionIntegral(text: string): {
    suppressionArea: number
    payoffArea: number
    dynamicSpr: number | null
  } {
    const report = this.evaluateChapterText(text, 0)
    return {
      suppressionArea: report.suppressionSum,
      payoffArea: report.payoffSum,
      dynamicSpr: report.spr,
    }
  }

  public calculateSPR(suppressionCount: number, payoffCount: number): number | null {
    if (
      !Number.isFinite(suppressionCount) ||
      !Number.isFinite(payoffCount) ||
      suppressionCount < 0 ||
      payoffCount <= 0
    )
      return null
    return suppressionCount / payoffCount
  }

  public evaluateChapterText(text: string, chapterIndex: number): ChapterEmotionalScore {
    const setup = this.locate(text, chapterIndex, SUPPRESSION_CUES, 'setup-term')
    const outcome = this.locate(text, chapterIndex, PAYOFF_CUES, 'outcome-term')
    return {
      chapterIndex,
      suppressionSum: setup.length,
      payoffSum: outcome.length,
      spr: this.calculateSPR(setup.length, outcome.length),
      dominantTags: [
        ...(setup.length ? ['压迫定位词'] : []),
        ...(outcome.length ? ['结果定位词'] : []),
      ],
      observations: [...setup, ...outcome].sort((a, b) => a.startOffset - b.startOffset),
    }
  }

  public diagnoseGoldenThree(
    ch1Text: string,
    ch2Text: string,
    ch3Text: string,
  ): GoldenThreeDiagnostic {
    const observations = [ch1Text, ch2Text, ch3Text]
      .flatMap((text, index) => [
        ...this.evaluateChapterText(text, index + 1).observations,
        ...this.locate(text, index + 1, GOLDEN_FINGER_CUES, 'ability-term'),
        ...this.locate(text, index + 1, HOOK_CUES, 'question-term'),
      ])
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.startOffset - b.startOffset)
    return {
      observations,
      missingChapters: [ch1Text, ch2Text, ch3Text].flatMap((text, index) =>
        text.trim() ? [] : [index + 1],
      ),
      advice:
        '以下仅定位词项。请结合否定、对白和上下文检查实际承诺与兑现；词频不表示质量或受众反应。',
    }
  }

  public auditContracts(contracts: ExpectationContract[], currentChapter: number) {
    const total = contracts.length
    const fulfilled = contracts.filter((c) => c.status === 'fulfilled').length
    const active = contracts.filter(
      (c) => c.status === 'planted' || c.status === 'building' || c.status === 'climax',
    )
    const positioned = Number.isSafeInteger(currentChapter) && currentChapter > 0
    const hasDeadline = (c: ExpectationContract) =>
      Number.isSafeInteger(c.promisedResolveChapter) && c.promisedResolveChapter > 0
    const overdue = active.filter(
      (c) => positioned && hasDeadline(c) && c.promisedResolveChapter < currentChapter,
    )
    const dueContracts = active.filter(
      (c) => positioned && hasDeadline(c) && c.promisedResolveChapter === currentChapter,
    )
    const unknownDeadlines = active.filter((c) => !hasDeadline(c))
    return {
      total,
      fulfilled,
      activeCount: active.length,
      overdueContracts: overdue,
      dueContracts,
      unknownDeadlines,
      fulfillmentRate: total ? Math.round((fulfilled / total) * 100) : null,
    }
  }
}
export const expectationEngine = new ExpectationEngine()
