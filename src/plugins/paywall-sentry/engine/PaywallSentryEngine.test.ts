import { describe, it, expect } from 'vitest'
import { PaywallSentryEngine } from './PaywallSentryEngine'

describe('PaywallSentryEngine', () => {
  it('handles very short or empty chapters gracefully', () => {
    const res = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c-short',
      chapterTitle: '短小章',
      chapterOrder: 1,
      content: '只有几个字',
    })
    expect(res.ppiScore).toBe(20)
    expect(res.recommendation).toBe('weak_cut')
    expect(res.suggestions.length).toBeGreaterThan(0)
  })

  it('detects strong cliffhanger and high climax in a climax chapter', () => {
    const text = `
      陆沉凌空而立，手中诛仙剑发出撕裂虚空的轰鸣！
      九霄雷劫汇聚，狂暴的威压碾压而下，全场大能无不倒吸一口凉气！
      这件尘封万载的神级宝箱终于突破封印，爆出亿万丈耀眼金芒！
      然而就在主角伸手触碰神物的前一瞬——
      虚空中突然探出一只漆黑枯骨巨爪，冷笑如雷：“小辈，留命来！”
      那是……
    `.repeat(3)

    const res = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c-vip',
      chapterTitle: '第100章 惊天剧变',
      chapterOrder: 100,
      content: text,
    })

    expect(res.ppiScore).toBeGreaterThanOrEqual(70)
    expect(res.cliffhangerScore).toBeGreaterThan(60)
    expect(res.powerClimaxScore).toBeGreaterThan(50)
    expect(res.recommendation).toBe('prime_paywall')
  })

  it('detects high fatigue risk in long expositional chapters', () => {
    const text = `
      众所周知，根据记载，上古时期的修真体系是极其繁琐的。
      换言之，从某种意义上来说，天地灵气与五行相生相克。
      客观来说，这个大陆共有九州三十六郡。
      总而言之，顾名思义，修道者必须顺应天命。
      也就是说，若想进入宗门，就必须经过漫长的体能测试与家世背景调查。
    `.repeat(15)

    const res = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c-boring',
      chapterTitle: '第50章 宗门规章大典',
      chapterOrder: 50,
      content: text,
    })

    expect(res.fatigueRiskScore).toBeGreaterThanOrEqual(50)
    expect(res.recommendation).toBe('toxic_drop')
  })
})
