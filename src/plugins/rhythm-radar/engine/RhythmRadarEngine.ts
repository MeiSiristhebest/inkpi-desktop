import type { CliffhangerType, PacingStatus, CliffhangerSuggestion } from '../types'

/**
 * RhythmRadarEngine (剧情节奏与断章雷达引擎)
 *
 * 理论基础：
 * 1. 叙事密度与情感极性复合张力函数 T(c) = alpha * |Sentiment| + beta * ActionDensity + gamma * Conflict
 * 2. 4 大黄金断章分类器 (生死悬念、信息反转、情绪高潮、世界颠覆)
 */
export class RhythmRadarEngine {
  /**
   * 分析单章张力指数与断章建议
   */
  public static analyzeChapter(
    text: string,
    _chapterId: string,
    _chapterOrder: number,
  ): {
    tensionScore: number
    pacingStatus: PacingStatus
    cliffhanger: CliffhangerSuggestion
    actionDensity: number
    sentimentValence: number
  } {
    if (!text || text.trim().length === 0) {
      return {
        tensionScore: 0.3,
        pacingStatus: 'optimal',
        cliffhanger: {
          type: 'emotional_climax',
          recommendedCutSnippet: '',
          hookPrompt: '正文过短，建议补充冲突与转折后断章。',
          punchline: '留白等待起笔',
        },
        actionDensity: 0.2,
        sentimentValence: 0.0,
      }
    }

    // 1. 动词与动作密度统计 (Action Density)
    // 扩展多字词与广泛冲突表征（对峙、逼近、博弈、暗杀、生死存亡等）
    const combatWords = (
      text.match(
        /(杀|斩|破|轰|死|血|剑|刀|爆|灭|震|撕|雷|对峙|突袭|搏杀|危机|生死|博弈|决绝|绝境)/g,
      ) || []
    ).length
    // 每百字动作词密度，最高 1.0
    const actionDensity = Math.min(1.0, combatWords / Math.max(1, text.length / 100))

    // 2. 情感极性与唤醒度 (Arousal & Valence)
    // Russell 情感环状模型：张力本质源于 Arousal (唤醒度 / 情绪激烈度)
    const positiveWords = (text.match(/(喜|笑|胜|突破|得道|生机|希望|狂喜|温暖)/g) || []).length
    const negativeWords = (text.match(/(悲|怒|恨|绝望|痛|崩塌|败|陨落|冰冷)/g) || []).length
    // valence: 净情感极性方向（0 到 1，保留做情绪偏向指标）
    const sentimentValence = Math.min(1.0, Math.abs(positiveWords - negativeWords) / 10)
    // arousal: 情绪总唤醒度，正面与负面交织冲击体现高张力，避免悲喜抵消
    const emotionalArousal = Math.min(1.0, (positiveWords + negativeWords) / 5)

    // 3. 冲突对立强度 (Conflict Factor)
    const conflictWords = (text.match(/(敌|抗|阻|争|战|叛|谋|仇|险|劫|锁|怒|狂)/g) || []).length
    const conflictFactor = Math.min(1.0, conflictWords / Math.max(1, text.length / 100))

    // 4. 复合张力指数 T = 0.50 * Action + 0.30 * Arousal + 0.20 * Conflict
    const tensionScore =
      Math.round((0.5 * actionDensity + 0.3 * emotionalArousal + 0.2 * conflictFactor) * 100) / 100

    let pacingStatus: PacingStatus = 'optimal'
    if (tensionScore < 0.2) pacingStatus = 'dragged'
    else if (tensionScore > 0.8) pacingStatus = 'fatiguing'

    // 4. 章末 200 字区域断章切口识别
    const tailSnippet = text.slice(-250)
    let type: CliffhangerType = 'life_and_death'
    let hookPrompt = '在致命一击落下、悬念未决的极值时刻骤然截断！'
    let punchline = '剑锋距离咽喉仅剩半寸...'

    if (
      tailSnippet.includes('冷笑') ||
      tailSnippet.includes('原来') ||
      tailSnippet.includes('真相') ||
      tailSnippet.includes('竟是')
    ) {
      type = 'info_twist'
      hookPrompt = '核心情报刚刚揭晓冰山一角，彻底颠覆读者固有认知，引发疯狂追读！'
      punchline = '门后的黑影转过身来，赫然是...'
    } else if (
      tailSnippet.includes('誓') ||
      tailSnippet.includes('天地') ||
      tailSnippet.includes('苍生') ||
      tailSnippet.includes('吼')
    ) {
      type = 'emotional_climax'
      hookPrompt = '人物内心执念在此刻彻底爆发，立下不可逆的誓言，情绪推至最高潮！'
      punchline = '今日我若不死，必叫这诸天神佛尽皆俯首！'
    } else if (
      tailSnippet.includes('规则') ||
      tailSnippet.includes('天道') ||
      tailSnippet.includes('天道崩塌') ||
      tailSnippet.includes('破碎')
    ) {
      type = 'world_shatter'
      hookPrompt = '底层世界观法则发生根本性崩坏，既有秩序荡然无存！'
      punchline = '天穹裂开了一道无法愈合的深渊巨口...'
    }

    return {
      tensionScore,
      pacingStatus,
      cliffhanger: {
        type,
        recommendedCutSnippet: tailSnippet.slice(-60),
        hookPrompt,
        punchline,
      },
      actionDensity,
      sentimentValence,
    }
  }
}
