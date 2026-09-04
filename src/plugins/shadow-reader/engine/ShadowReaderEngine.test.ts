import { describe, it, expect } from "vitest"
import { ShadowReaderEngine } from "./ShadowReaderEngine"

describe("ShadowReaderEngine (读者弹幕与毒点预判模拟器)", () => {
  it("当出现主角圣母原谅敌人的桥段时，精准触发爽友暴躁毒点警报", () => {
    const text = "林凡叹了口气道：算了吧，我们退一步海阔天空，原谅了他这次。"
    const result = ShadowReaderEngine.simulate(text, "ch1")

    expect(result.toxicAlertCount).toBeGreaterThan(0)
    const alert = result.danmakus.find((d) => d.isToxicAlert)
    expect(alert).toBeDefined()
    expect(alert?.personaType).toBe("power_fantasy")
    expect(alert?.content).toContain("毒死我了")
  })

  it("当出现经典装逼打脸反杀时，生成爽感体验党喝彩弹幕", () => {
    const text = "林凡一剑封喉！全场寂静，在场所有弟子纷纷倒吸一口凉气！"
    const result = ShadowReaderEngine.simulate(text, "ch2")

    expect(result.sentimentSummary.excited).toBeGreaterThan(0)
    const cheer = result.danmakus.find((d) => d.sentiment === "excited")
    expect(cheer?.content).toContain("倒吸凉气")
  })
})
