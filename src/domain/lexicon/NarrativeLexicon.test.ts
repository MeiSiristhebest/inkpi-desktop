import { describe, it, expect } from 'vitest'
import {
  NarrativeLexiconService,
  UNIFIED_NARRATIVE_LEXICON,
  SUSPENSE_TRIGGER_WORDS,
} from './NarrativeLexicon'

describe('NarrativeLexiconService (统一叙事语境词库)', () => {
  it('应当对纯设定水词在任何位置均返回高水分惩罚且零悬念增益', () => {
    const recapResBody = NarrativeLexiconService.evaluatePhrase('正如前文所说', false)
    expect(recapResBody.bloatPenalty).toBeGreaterThanOrEqual(8)
    expect(recapResBody.hookBenefit).toBe(0)

    const recapResTail = NarrativeLexiconService.evaluatePhrase('正如前文所说', true)
    expect(recapResTail.bloatPenalty).toBeGreaterThanOrEqual(8)
    expect(recapResTail.hookBenefit).toBe(0)
  })

  it('对戏剧套话词在章尾与正文中表现出不同的语境裁决', () => {
    // 正文中：视为水词，零悬念
    const bodyRes = NarrativeLexiconService.evaluatePhrase('瞳孔骤缩', false)
    expect(bodyRes.bloatPenalty).toBe(6)
    expect(bodyRes.hookBenefit).toBe(0)

    // 章尾处：水分惩罚大幅削减，提供强悬念加成
    const tailRes = NarrativeLexiconService.evaluatePhrase('瞳孔骤缩', true)
    expect(tailRes.bloatPenalty).toBeLessThan(bodyRes.bloatPenalty)
    expect(tailRes.hookBenefit).toBeGreaterThan(5)
  })

  it('收录了基础高频词库与触发词集合', () => {
    expect(UNIFIED_NARRATIVE_LEXICON.length).toBeGreaterThan(15)
    expect(SUSPENSE_TRIGGER_WORDS).toContain('突然')
    expect(SUSPENSE_TRIGGER_WORDS).toContain('崩塌')
  })
})
