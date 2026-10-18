import type { ReaderPersonaType, ShadowSimulationResult } from '../types'

/** Provides literal questions in reading order; semantic blind review uses the grounded AI path. */
export class ShadowReaderEngine {
  private static readonly QUESTIONS: Array<{
    persona: ReaderPersonaType
    label: string
    pattern: RegExp
    question: string
  }> = [
    {
      persona: 'power_fantasy',
      label: '角色选择视角',
      pattern: /(忍气吞声|跪下|赔礼道歉|算了吧|原谅了他|不计前嫌|不忍加害|饶恕|息事宁人)/,
      question: '这是事实、否定、转述还是假设？仅按读到此处的信息，角色为何做出或拒绝该选择？',
    },
    {
      persona: 'romance_shipper',
      label: '关系视角',
      pattern: /(转赠他人|献给公子|与他人结为连理|默默看着她离去|拱手相让|另寻良配)/,
      question: '这是谁的选择或说法？关系双方的目标与自主决定是否可见？',
    },
    {
      persona: 'critical_toxic',
      label: '因果视角',
      pattern: /(越级斩杀|随手一拳轰碎星辰|明明是练气期|瞬间横跨|眨眼间突破|毫无悬念地秒杀)/,
      question: '此前正文明确给出了哪些能力和限制？缺少依据时不能认定设定冲突。',
    },
    {
      persona: 'plot_detective',
      label: '线索视角',
      pattern: /(黑衣人|神秘微笑|目光微闪|当年的密信|暗中布局|蛛丝马迹|异样波动)/,
      question: '读者此时知道什么、猜测什么？不使用后文或作者笔记推断真相。',
    },
    {
      persona: 'lore_scholar',
      label: '设定视角',
      pattern: /(一剑封喉|全场寂静|震撼全场|倒吸一口凉气|这怎么可能|死寂|底牌尽显|神色骤变)/,
      question: '结果由哪些已见行动支持？词项本身不证明高光、反杀或读者情绪。',
    },
  ]

  static buildAnalysisInput(
    chapterTitle: string,
    chapterText: string,
    source?: {
      chapterId?: string
      sourceRevision?: number
      sourceKind?: 'saved-chapter' | 'edited-copy'
    },
  ): Record<string, unknown> {
    return {
      chapterTitle: chapterTitle || '未命名章节',
      chapterText,
      source: {
        chapterId: source?.chapterId ?? null,
        revision: source?.sourceRevision ?? null,
        kind: source?.sourceKind ?? 'edited-copy',
      },
      personas: this.QUESTIONS.map((rule) => ({ id: rule.persona, focus: rule.question })),
      readerScope:
        'Use only the supplied text in reading order. Separate explicitly revealed facts, plausible reader hypotheses and unresolved questions. Never import future events, private character knowledge or author worldbook facts into a reader conclusion.',
    }
  }

  static simulate(
    chapterText: string,
    chapterId: string,
    options?: {
      genreContext?: 'cultivation' | 'scifi' | 'urban' | 'fantasy' | 'general'
      customPersonas?: string[]
    },
  ): ShadowSimulationResult {
    const selected = options?.customPersonas
    const danmakus: ShadowSimulationResult['danmakus'] = []
    let paragraphIndex = 0
    for (const line of chapterText.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
      const paragraph = line[0].replace(/(?:\r\n|\r|\n)$/, '')
      const index = paragraphIndex++
      if (!paragraph.trim()) continue
      for (const rule of this.QUESTIONS) {
        if (selected && !selected.includes(rule.persona)) continue
        const match = rule.pattern.exec(paragraph)
        if (!match) continue
        const sourceStart = line.index + match.index
        const sourceEnd = sourceStart + match[0].length
        danmakus.push({
          chapterId,
          paragraphIndex: index,
          personaType: rule.persona,
          personaName: rule.label,
          content: `本段包含“${match[0]}”。${rule.question}`,
          sentiment: 'review_question',
          isToxicAlert: false,
          sourceStart,
          sourceEnd,
          sourceQuote: chapterText.slice(sourceStart, sourceEnd),
        })
      }
    }
    return {
      danmakus,
      toxicAlertCount: 0,
      sentimentSummary: { rage: 0, applause: 0, suspicious: 0, excited: 0 },
    }
  }
}
