import { describe, it, expect } from "vitest"
import { AudioSynthesizerEngine } from "./AudioSynthesizerEngine"

describe("AudioSynthesizerEngine (机械键盘物理声学合成引擎)", () => {
  it("根据不同轴体输出准确的瞬态与共鸣频率参数", () => {
    const blueParams = AudioSynthesizerEngine.getSwitchParams("blue")
    expect(blueParams.transientFreq).toBe(3200)
    expect(blueParams.transientDecay).toBeLessThan(0.02)

    const brownParams = AudioSynthesizerEngine.getSwitchParams("brown")
    expect(brownParams.transientFreq).toBe(1100)

    const vintageParams = AudioSynthesizerEngine.getSwitchParams("vintage")
    expect(vintageParams.transientFreq).toBe(2200)
    expect(vintageParams.resonanceDecay).toBeGreaterThan(0.05)
  })

  it("在无浏览器环境（测试环境）下优雅降级不抛异常", () => {
    const engine = new AudioSynthesizerEngine()
    expect(() => engine.triggerKeyPress("blue")).not.toThrow()
    expect(() => engine.startAmbience("rain")).not.toThrow()
    expect(() => engine.stopAmbience()).not.toThrow()
  })
})
