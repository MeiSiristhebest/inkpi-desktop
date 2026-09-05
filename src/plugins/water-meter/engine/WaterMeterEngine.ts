import type { WaterAuditReport, WaterBloatItem, WaterLevel } from '../types'
import {
  UNIFIED_NARRATIVE_LEXICON,
  CORE_ACTION_VERBS,
} from '../../../domain/lexicon/NarrativeLexicon'
import { pluginEventBus } from '../../../core/pluginEventBus'

const PHANTOM_CLICHES = [
  ...UNIFIED_NARRATIVE_LEXICON.filter(
    (e) => e.category === 'DRAMATIC_TENSION_CLICHE'
  ).map((e) => e.phrase),
  '忍不住',
  '不由得',
  '暗暗心惊',
  '只觉得',
  '下意识地',
  '后背被冷汗浸透',
  '冷汗涔涔',
  '面露震惊之色',
  '满脸不可思议',
]

const RECAP_BLOATS = [
  ...UNIFIED_NARRATIVE_LEXICON.filter(
    (e) => e.category === 'PURE_FILLER_RECAP'
  ).map((e) => e.phrase),
  '所谓炼气期',
]

const MODIFIER_BLOATS = [
  ...UNIFIED_NARRATIVE_LEXICON.filter(
    (e) => e.category === 'MODIFIER_STACK'
  ).map((e) => e.phrase),
  '绝对绝对',
  '分外格外的',
]

const ACTION_VERBS = CORE_ACTION_VERBS

export class WaterMeterEngine {
  /**
   * 测算香农信息熵 H(X) = -sum P(x) log2 P(x)
   */
  computeShannonEntropy(text: string): number {
    if (!text || text.length === 0) return 0
    const freqs: Record<string, number> = {}
    const clean = text.replace(/[\s\r\n\t]/g, '')
    if (clean.length === 0) return 0

    for (const char of clean) {
      freqs[char] = (freqs[char] || 0) + 1
    }

    let entropy = 0
    const total = clean.length
    for (const count of Object.values(freqs)) {
      const p = count / total
      entropy -= p * Math.log2(p)
    }

    return Math.round(entropy * 100) / 100
  }

  /**
   * 全文水分审计
   */
  auditText(
    text: string,
    context?: { projectId?: string; chapterId?: string }
  ): WaterAuditReport {
    const rawText = (text || '').trim()
    const totalWordCount = rawText.replace(/\s+/g, '').length

    if (totalWordCount < 20) {
      return {
        waterScore: 0,
        waterLevel: 'lean',
        entropyScore: 0,
        actionVerbRatio: 0,
        clicheRatio: 0,
        totalWordCount,
        estimatedLeanWordCount: totalWordCount,
        dehydrationRate: 0,
        bloatItems: [],
        advice: ['文本字数较少，请在正文展开后再进行水分与信息熵深度审计。'],
      }
    }

    const bloatItems: WaterBloatItem[] = []

    // 1. 假动作与陈词滥调检测
    let clicheCharCount = 0
    for (const phrase of PHANTOM_CLICHES) {
      let idx = 0
      while ((idx = rawText.indexOf(phrase, idx)) !== -1) {
        bloatItems.push({
          type: 'phantom',
          text: phrase,
          reason: `假动作套话：情绪反应公式化，未能提供实质推进。`,
        })
        clicheCharCount += phrase.length
        idx += phrase.length
      }
    }

    // 2. 解释性重读与设定水文
    for (const phrase of RECAP_BLOATS) {
      let idx = 0
      while ((idx = rawText.indexOf(phrase, idx)) !== -1) {
        bloatItems.push({
          type: 'recap',
          text: phrase,
          reason: `设定重述水词：读者已知设定无需反复口播交代。`,
        })
        clicheCharCount += phrase.length
        idx += phrase.length
      }
    }

    // 3. 修饰语重复堆砌
    for (const phrase of MODIFIER_BLOATS) {
      let idx = 0
      while ((idx = rawText.indexOf(phrase, idx)) !== -1) {
        bloatItems.push({
          type: 'modifier',
          text: phrase,
          reason: `修饰语过度堆叠：削弱了文字本身的力量感。`,
        })
        clicheCharCount += phrase.length
        idx += phrase.length
      }
    }

    // 4. 动作动词密度
    let actionVerbCount = 0
    for (const char of rawText) {
      if (ACTION_VERBS.includes(char)) {
        actionVerbCount++
      }
    }

    const actionVerbRatio =
      Math.round((actionVerbCount / Math.max(1, totalWordCount)) * 1000) / 1000
    const clicheRatio =
      Math.round((clicheCharCount / Math.max(1, totalWordCount)) * 1000) / 1000
    const entropyScore = this.computeShannonEntropy(rawText)

    // 水分评分 (0-100)：动词少 + 套话多 + 熵低
    // 基准期望：AVR ~ 0.08, CR <= 0.01, Entropy ~ 5.5
    let score = 0
    if (actionVerbRatio < 0.06) {
      score += Math.round((0.06 - actionVerbRatio) * 600)
    }
    score += Math.round(Math.min(45, clicheRatio * 500))
    if (entropyScore < 5.0 && totalWordCount > 100) {
      score += Math.round((5.0 - entropyScore) * 12)
    }

    score = Math.max(0, Math.min(100, score))

    let waterLevel: WaterLevel = 'lean'
    if (score >= 65) waterLevel = 'flooded'
    else if (score >= 45) waterLevel = 'watery'
    else if (score >= 25) waterLevel = 'normal'
    else waterLevel = 'lean'

    // 脱水率与预估精简字数
    const dehydrationRate = Math.min(
      40,
      Math.max(2, Math.round(score * 0.35 + (clicheCharCount / totalWordCount) * 100))
    )
    const estimatedLeanWordCount = Math.max(
      10,
      Math.round(totalWordCount * (1 - dehydrationRate / 100))
    )

    const advice: string[] = []
    if (bloatItems.some((b) => b.type === 'phantom')) {
      advice.push('删除“倒吸凉气/暗暗心惊/深吸一口气”等假动作，直接展现动作后果或角色下一步决定。')
    }
    if (bloatItems.some((b) => b.type === 'recap')) {
      advice.push('砍掉“众所周知/修仙界大家都知道”等前情提要口播，融入事件冲突中自然交代。')
    }
    if (actionVerbRatio < 0.04) {
      advice.push('动作动词密度偏低（剧情推进迟缓），建议增加具象肢体交锋、环境破坏或空间位移。')
    }
    if (advice.length === 0) {
      advice.push('文字精炼度极佳，无明显冗余水词，保持当前的叙事密度！')
    }

    // 广播章节正文审计完成事件 (CHAPTER_CONTENT_AUDITED)
    if (context?.projectId && context?.chapterId) {
      try {
        pluginEventBus.emit('CHAPTER_CONTENT_AUDITED', {
          projectId: context.projectId,
          chapterId: context.chapterId,
          wordCount: totalWordCount,
          waterScore: score,
        })
      } catch (err) {
        console.warn('[WaterMeterEngine] Failed to emit CHAPTER_CONTENT_AUDITED:', err)
      }
    }

    return {
      waterScore: score,
      waterLevel,
      entropyScore,
      actionVerbRatio,
      clicheRatio,
      totalWordCount,
      estimatedLeanWordCount,
      dehydrationRate,
      bloatItems,
      advice,
    }
  }
}

export const waterMeterEngine = new WaterMeterEngine()
