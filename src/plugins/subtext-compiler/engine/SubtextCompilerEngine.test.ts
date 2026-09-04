import { describe, it, expect } from "vitest"
import { SubtextCompilerEngine } from "./SubtextCompilerEngine"

describe("SubtextCompilerEngine (潜台词与冰山对白双轨编译器)", () => {
  it("将口头平淡对白成功编译为带有水下潜台词和微动作的三轨体系", () => {
    const track = SubtextCompilerEngine.compile("你做得很好，我很替你高兴。", "大师兄", "jealousy")

    expect(track.subtext).toContain("凭什么是你")
    expect(track.beatAction).toContain("嘴角勉强扯出一抹僵硬的笑意")
    expect(track.tensionLevel).toBeGreaterThanOrEqual(4)
  })

  it("能自动将三轨对白渲染为富有张力的小说标准行文段落", () => {
    const track = SubtextCompilerEngine.compile("无妨，这点伤势还死不了。", "林凡", "fear")
    const rendered = SubtextCompilerEngine.renderNovelParagraph(track)

    expect(rendered).toContain("林凡手指无意识地摩挲着腰间剑柄")
    expect(rendered).toContain("“无妨，这点伤势还死不了。”")
  })
})
