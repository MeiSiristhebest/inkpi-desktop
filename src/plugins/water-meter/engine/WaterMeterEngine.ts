import type { WaterAuditReport, WaterBloatItem } from '../types'
import {
  UNIFIED_NARRATIVE_LEXICON,
  CORE_ACTION_VERBS,
} from '../../../domain/lexicon/NarrativeLexicon'
import { pluginEventBus } from '../../../core/pluginEventBus'

const PHANTOM_CLICHES = [
  ...UNIFIED_NARRATIVE_LEXICON.filter((e) => e.category === 'DRAMATIC_TENSION_CLICHE').map(
    (e) => e.phrase,
  ),
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
  ...UNIFIED_NARRATIVE_LEXICON.filter((e) => e.category === 'PURE_FILLER_RECAP').map(
    (e) => e.phrase,
  ),
  '所谓炼气期',
]

const MODIFIER_BLOATS = [
  ...UNIFIED_NARRATIVE_LEXICON.filter((e) => e.category === 'MODIFIER_STACK').map((e) => e.phrase),
  '绝对绝对',
  '分外格外的',
]

const ACTION_VERBS = CORE_ACTION_VERBS

export class WaterMeterEngine {
  /** Empirical character-frequency entropy, not semantic information or literary quality. */
  computeShannonEntropy(text: string): number {
    const characters = [...text].filter((char) => !/\s/u.test(char))
    if (!characters.length) return 0
    const frequencies = new Map<string, number>()
    for (const char of characters) frequencies.set(char, (frequencies.get(char) ?? 0) + 1)
    let entropy = 0
    for (const count of frequencies.values()) {
      const probability = count / characters.length
      entropy -= probability * Math.log2(probability)
    }
    return Math.round(entropy * 100) / 100
  }

  auditText(text: string, context?: { projectId?: string; chapterId?: string }): WaterAuditReport {
    const rawText = text || ''
    const bloatItems: WaterBloatItem[] = []
    const covered = new Set<number>()
    const seen = new Set<string>()
    const groups: Array<[WaterBloatItem['type'], string[]]> = [
      ['phantom', PHANTOM_CLICHES],
      ['recap', RECAP_BLOATS],
      ['modifier', MODIFIER_BLOATS],
    ]
    for (const [type, terms] of groups) {
      for (const phrase of new Set(terms)) {
        if (!phrase) continue
        let start = rawText.indexOf(phrase)
        while (start >= 0) {
          const key = start + ':' + phrase
          if (!seen.has(key)) {
            seen.add(key)
            const end = start + phrase.length
            bloatItems.push({
              type,
              text: rawText.slice(start, end),
              start,
              end,
              reason: '词表命中；请结合动作、语气和信息作用决定是否修改，命中本身不证明冗余。',
            })
            for (let position = start; position < end; position++) covered.add(position)
          }
          start = rawText.indexOf(phrase, start + 1)
        }
      }
    }
    bloatItems.sort((a, b) => a.start! - b.start! || b.text.length - a.text.length)
    let totalWordCount = 0
    let matchedCharacters = 0
    let actionVerbCount = 0
    let offset = 0
    for (const char of rawText) {
      if (!/\s/u.test(char)) {
        ++totalWordCount
        if (covered.has(offset)) ++matchedCharacters
        if (ACTION_VERBS.includes(char)) ++actionVerbCount
      }
      offset += char.length
    }
    const report: WaterAuditReport = {
      entropyScore: this.computeShannonEntropy(rawText),
      actionVerbRatio: totalWordCount ? actionVerbCount / totalWordCount : 0,
      clicheRatio: totalWordCount ? matchedCharacters / totalWordCount : 0,
      totalWordCount,
      matchedCharacters,
      bloatItems,
      advice: !rawText.trim()
        ? ['尚无正文，无法检查其叙事作用。']
        : bloatItems.length
          ? ['逐处查看词项在句中的作用；修改前复核是否会丢失动作、语气、强调或必要信息。']
          : ['词表没有命中。字符统计不能判断文本质量或叙事作用。'],
    }
    if (context?.projectId && context.chapterId) {
      pluginEventBus.emit('CHAPTER_CONTENT_AUDITED', {
        projectId: context.projectId,
        chapterId: context.chapterId,
        wordCount: totalWordCount,
      })
    }
    return report
  }
}

export const waterMeterEngine = new WaterMeterEngine()
