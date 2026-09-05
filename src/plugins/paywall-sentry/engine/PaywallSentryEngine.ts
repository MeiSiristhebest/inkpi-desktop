import type { PaywallAuditResult, PaywallRecommendation } from '../types'
import {
  NarrativeLexiconService,
  SUSPENSE_TRIGGER_WORDS,
  UNIFIED_NARRATIVE_LEXICON,
} from '../../../domain/lexicon/NarrativeLexicon'

export class PaywallSentryEngine {
  /**
   * 综合分析单个章节作为付费卡点（上架首 VIP 章、或者倒数免费章分界点）的势能表现
   * PPI (Paywall Potential Index) = 0.35 * C + 0.25 * D + 0.25 * P - 0.15 * F
   */
  static analyzeChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    content: string
  }): PaywallAuditResult {
    const { chapterId, chapterTitle, chapterOrder, content } = params
    const wordCount = content.replace(/\s+/g, '').length

    if (!content || wordCount < 50) {
      return {
        chapterId,
        chapterTitle,
        chapterOrder,
        wordCount,
        ppiScore: 20,
        cliffhangerScore: 10,
        unresolvedDesireScore: 20,
        powerClimaxScore: 10,
        fatigueRiskScore: 30,
        recommendation: 'weak_cut',
        suggestions: ['章节字数过短，内容极度单薄，无法形成有效读者付费期待。'],
      }
    }

    // 1. 悬念留白强度 C (Cliffhanger Score)
    // 聚焦章尾最后 25% 文本或最后 400 字
    const tailLength = Math.min(400, Math.max(100, Math.floor(content.length * 0.25)))
    const tailText = content.slice(-tailLength)
    const cliffhangerScore = this.computeCliffhangerScore(tailText)

    // 2. 悬而未决期待 D (Unresolved Desire Score)
    const unresolvedDesireScore = this.computeUnresolvedDesireScore(content, tailText)

    // 3. 战力/爽点情绪高潮 P (Power Climax Score)
    const powerClimaxScore = this.computePowerClimaxScore(content)

    // 4. 冗余疲劳与平淡风险 F (Fatigue Risk Score)
    const fatigueRiskScore = this.computeFatigueRiskScore(content, wordCount)

    // 综合计算 PPI: 0.35*C + 0.35*D + 0.30*P - 0.10*F
    const rawPPI = 0.35 * cliffhangerScore + 0.35 * unresolvedDesireScore + 0.30 * powerClimaxScore - 0.10 * fatigueRiskScore
    const ppiScore = Math.max(0, Math.min(100, Math.round(rawPPI)))

    // 评级划分与实战建议生成
    let recommendation: PaywallRecommendation
    const suggestions: string[] = []

    if (ppiScore >= 70) {
      recommendation = 'prime_paywall'
      suggestions.push('🔥 黄金卡点：悬念情绪处于巅峰高位，极度适合作为首订收费卡点，转化率极高。')
    } else if (ppiScore >= 50) {
      recommendation = 'acceptable'
      suggestions.push('⚖️ 合格卡点：具备一定的情绪惯性与钩子，能够平稳承接付费转化。')
    } else if (fatigueRiskScore >= 60) {
      recommendation = 'toxic_drop'
      suggestions.push('☠️ 暴跌断更风险：本章充斥过多背景交代或平淡休整，在此卡点极易造成读者大量流失弃书。')
    } else {
      recommendation = 'weak_cut'
      suggestions.push('⚠️ 偏弱卡点：章尾悬念势能偏弱或事件已闭环收束，建议将关键危机前置或移至下一章交界处。')
    }

    if (cliffhangerScore < 50) {
      suggestions.push('💡 悬念提升建议：章尾最后一段宜采用“危机顿挫”或“未完之语”，避免在事件尘埃落定时突兀切断。')
    }
    if (unresolvedDesireScore < 40) {
      suggestions.push('💡 期待唤醒建议：强化主角的当务之急（如倒计时、生死契约、开箱奖励揭晓前一瞬）。')
    }
    if (fatigueRiskScore > 50) {
      suggestions.push('💡 节奏精简建议：削减大段设定描写或说明性旁白，压缩叙事水分以聚拢核心冲突。')
    }

    return {
      chapterId,
      chapterTitle,
      chapterOrder,
      wordCount,
      ppiScore,
      cliffhangerScore,
      unresolvedDesireScore,
      powerClimaxScore,
      fatigueRiskScore,
      recommendation,
      suggestions,
    }
  }

  private static computeCliffhangerScore(tailText: string): number {
    let score = 30

    // 1. 基于统一叙事语境词库的章尾留钩加权 (有明确语义依据，而非孤立规则)
    for (const item of UNIFIED_NARRATIVE_LEXICON) {
      if (tailText.includes(item.phrase)) {
        const evalRes = NarrativeLexiconService.evaluatePhrase(item.phrase, true)
        score += evalRes.hookBenefit
      }
    }

    // 2. 关键强转折与悬念触发词
    for (const kw of SUSPENSE_TRIGGER_WORDS) {
      if (tailText.includes(kw)) {
        score += 8
      }
    }

    // 标点结尾特征：以省略号、问号、破折号或感叹号结尾的悬念更强
    const trimmed = tailText.trim()
    if (/[……\.\.\.？！\?!—–-]$/.test(trimmed)) {
      score += 15
    } else if (/[。]$/.test(trimmed)) {
      // 句号收尾稍降悬念顿挫感
      score -= 5
    }

    return Math.max(10, Math.min(100, score))
  }

  private static computeUnresolvedDesireScore(content: string, tailText: string): number {
    let score = 25

    // 核心欲望与目标驱动词（宝箱、突破、揭榜、约定、审判等）
    const desirePatterns = [
      /奖励/g, /打开/g, /爆出/g, /突破/g, /进阶/g, /升级/g,
      /倒计时/g, /救/g, /秘密/g, /真相/g, /赌注/g, /复仇/g, /神殿/g
    ]

    let desireHits = 0
    for (const pat of desirePatterns) {
      const matches = content.match(pat)
      if (matches) {
        desireHits += matches.length
      }
    }
    score += Math.min(50, desireHits * 6)

    // 章尾出现关键承诺/欲望聚焦加分
    if (/(下一刻|究竟|到底|等待着|揭开|鹿死谁手)/.test(tailText)) {
      score += 20
    }

    return Math.max(10, Math.min(100, score))
  }

  private static computePowerClimaxScore(content: string): number {
    let score = 20

    // 战斗与冲突强度词
    const climaxPatterns = [
      /轰！/g, /轰隆/g, /狂暴/g, /惊骇/g, /碾压/g, /斩/g, /碎裂/g,
      /威压/g, /天劫/g, /杀意/g, /底牌/g, /暴怒/g, /剑气/g, /九霄/g
    ]

    let climaxHits = 0
    for (const pat of climaxPatterns) {
      const matches = content.match(pat)
      if (matches) {
        climaxHits += matches.length
      }
    }
    score += Math.min(65, climaxHits * 6)

    return Math.max(10, Math.min(100, score))
  }

  private static computeFatigueRiskScore(content: string, wordCount: number): number {
    let score = 20

    // 判定说明性文本、学术化词汇、大段环境描写比例
    const expPatterns = [
      /据悉/g, /总而言之/g, /换言之/g, /从某种意义上/g, /客观来说/g,
      /顾名思义/g, /也就是说/g, /根据记载/g, /史书记载/g, /众所周知/g
    ]

    for (const pat of expPatterns) {
      const matches = content.match(pat)
      if (matches) {
        score += matches.length * 6
      }
    }

    // 字数过长带来的单章边际递减疲劳
    // 依现代网络小说大章（6000-8000字）常态标准校准，避免在标准长章节下误判读者疲劳
    if (wordCount > 12000) {
      score += 25
    } else if (wordCount > 9000) {
      score += 15
    }

    return Math.max(10, Math.min(100, score))
  }
}
