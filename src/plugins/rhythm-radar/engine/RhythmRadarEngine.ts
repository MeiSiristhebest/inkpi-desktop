import type {
  CliffhangerType,
  PacingStatus,
  CliffhangerSuggestion,
} from "../types"

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
    _chapterOrder: number
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
        pacingStatus: "optimal",
        cliffhanger: {
          type: "emotional_climax",
          recommendedCutSnippet: "",
          hookPrompt: "正文过短，建议补充冲突与转折后断章。",
          punchline: "留白等待起笔",
        },
        actionDensity: 0.2,
        sentimentValence: 0.0,
      }
    }

    // 1. 动词与冲突密度统计 (Action & Conflict Density)
    const combatWords = (text.match(/(杀|斩|破|轰|死|血|剑|刀|爆|灭|震|撕|雷)/g) || []).length
    const actionDensity = Math.min(1.0, combatWords / (text.length / 100))

    // 2. 情感极性词汇 (Sentiment Valence)
    const positiveWords = (text.match(/(喜|笑|胜|突破|得道|生机|希望|狂喜|温暖)/g) || []).length
    const negativeWords = (text.match(/(悲|怒|恨|绝望|痛|崩塌|败|陨落|冰冷)/g) || []).length
    const sentimentValence = Math.min(1.0, Math.abs(positiveWords - negativeWords) / 10)

    // 3. 复合张力指数 T = 0.5 * Action + 0.5 * Valence
    const tensionScore = Math.round((0.55 * actionDensity + 0.45 * sentimentValence) * 100) / 100

    let pacingStatus: PacingStatus = "optimal"
    if (tensionScore < 0.2) pacingStatus = "dragged"
    else if (tensionScore > 0.8) pacingStatus = "fatiguing"

    // 4. 章末 200 字区域断章切口识别
    const tailSnippet = text.slice(-250)
    let type: CliffhangerType = "life_and_death"
    let hookPrompt = "在致命一击落下、悬念未决的极值时刻骤然截断！"
    let punchline = "剑锋距离咽喉仅剩半寸..."

    if (tailSnippet.includes("冷笑") || tailSnippet.includes("原来") || tailSnippet.includes("真相") || tailSnippet.includes("竟是")) {
      type = "info_twist"
      hookPrompt = "核心情报刚刚揭晓冰山一角，彻底颠覆读者固有认知，引发疯狂追读！"
      punchline = "门后的黑影转过身来，赫然是..."
    } else if (tailSnippet.includes("誓") || tailSnippet.includes("天地") || tailSnippet.includes("苍生") || tailSnippet.includes("吼")) {
      type = "emotional_climax"
      hookPrompt = "人物内心执念在此刻彻底爆发，立下不可逆的誓言，情绪推至最高潮！"
      punchline = "今日我若不死，必叫这诸天神佛尽皆俯首！"
    } else if (tailSnippet.includes("规则") || tailSnippet.includes("天道") || tailSnippet.includes("天道崩塌") || tailSnippet.includes("破碎")) {
      type = "world_shatter"
      hookPrompt = "底层世界观法则发生根本性崩坏，既有秩序荡然无存！"
      punchline = "天穹裂开了一道无法愈合的深渊巨口..."
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
