import { describe, it, expect } from "vitest"
import { RhythmRadarEngine } from "./RhythmRadarEngine"

describe("RhythmRadarEngine (剧情节奏与断章雷达)", () => {
  it("对充满战斗词汇的激烈章节准确评估高张力指数", () => {
    const fightText = "林凡拔剑怒斩！雷光轰然爆发，鲜血狂飙，剑气撕碎长空，杀意滔天！"
    const result = RhythmRadarEngine.analyzeChapter(fightText, "ch1", 1)

    expect(result.tensionScore).toBeGreaterThanOrEqual(0.6)
    expect(result.actionDensity).toBeGreaterThan(0.4)
  })

  it("当章末揭示秘密时，精准推荐 info_twist (信息反转) 黄金断章切口", () => {
    const twistText = "漫天尘埃落定。那刺客缓缓摘下脸上面具，冷笑一声道：其实我才是当年的真相。"
    const result = RhythmRadarEngine.analyzeChapter(twistText, "ch2", 2)

    expect(result.cliffhanger.type).toBe("info_twist")
    expect(result.cliffhanger.hookPrompt).toContain("颠覆读者固有认知")
  })
})
