import { describe, it, expect } from 'vitest'
import { GoldChaptersEngine } from './GoldChaptersEngine'

describe('GoldChaptersEngine (opening text rules)', () => {
  it('locates the existing opening vocabulary without claiming it measures quality', () => {
    const text = `林凡浑身浴血，冷冷看着面前逼迫退婚的长老。他心中的复仇火焰熊熊燃烧。
就在生死关头，他识海中突然响起一声清脆提示：神级觉醒系统已激活！
今日你们给予的欺凌，他来日誓要千百倍奉还！`

    const result = GoldChaptersEngine.evaluate(text)
    expect(result.observations.map((item) => item.dimension)).toEqual([
      'motivation',
      'distinctive_asset',
      'conflict',
      'ending_hook',
    ])
    for (const item of result.observations) {
      expect(text.slice(item.start, item.end)).toBe(item.quote)
    }
    expect(result).not.toHaveProperty('score')
  })

  it('does not diagnose absent plot features from missing keywords', () => {
    const dullText = `这是一个修仙世界。这个世界分为很多大陆，有东胜神洲，有西牛贺洲。早晨的阳光很好，林凡起床洗脸吃早饭。天气很晴朗。`
    const result = GoldChaptersEngine.evaluate(dullText)

    expect(result.status).toBe('no-matches')
    expect(result.observations).toEqual([])
    expect(result.complete).toBe(true)
    expect(result).not.toHaveProperty('suggestions')
  })
})
