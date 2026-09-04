import { describe, it, expect } from "vitest"
import { GoldChaptersEngine } from "./GoldChaptersEngine"

describe("GoldChaptersEngine (黄金三章与签约过稿诊断器)", () => {
  it("对具备强烈动机、金手指及时登场与明确冲突的前三章判定为高分签约过稿", () => {
    const text = `林凡浑身浴血，冷冷看着面前逼迫退婚的长老。他心中的复仇火焰熊熊燃烧。
就在生死关头，他识海中突然响起一声清脆提示：神级觉醒系统已激活！
今日你们给予的欺凌，他来日誓要千百倍奉还！`

    const result = GoldChaptersEngine.evaluate(text)
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.isQualified).toBe(true)
    expect(result.keyDiagnosis.length).toBeGreaterThan(0)
  })

  it("对缺乏金手指、没有冲突的流水账前三章判定为不及格并提供靶向重写建议", () => {
    const dullText = `这是一个修仙世界。这个世界分为很多大陆，有东胜神洲，有西牛贺洲。早晨的阳光很好，林凡起床洗脸吃早饭。天气很晴朗。`
    const result = GoldChaptersEngine.evaluate(dullText)

    expect(result.score).toBeLessThan(75)
    expect(result.isQualified).toBe(false)
    expect(result.suggestions.length).toBeGreaterThan(0)
  })
})
