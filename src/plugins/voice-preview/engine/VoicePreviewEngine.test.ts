import { describe, it, expect } from "vitest"
import { VoicePreviewEngine } from "./VoicePreviewEngine"

describe("VoicePreviewEngine (角色拟真有声对白试听器)", () => {
  it("能从网文段落中精确抽取说话人角色与引述对白，并识别情感倾向", () => {
    const text = `
林凡冷笑道：“三十年河东，三十年河西，莫欺少年穷！”
赵家长老厉声喝道：“放肆！无知小辈安敢口出狂言，给我受死！”
苏清月低声耳语：“林凡哥哥，小心他的烈火剑气。”
`
    const script = VoicePreviewEngine.extractScript(text)

    expect(script.totalLines).toBe(3)
    expect(script.characterSpeakers).toContain("林凡")
    expect(script.characterSpeakers).toContain("赵家长老")
    expect(script.characterSpeakers).toContain("苏清月")

    expect(script.lines[0].emotion).toBe("cold")
    expect(script.lines[1].emotion).toBe("angry")
    expect(script.lines[2].emotion).toBe("whisper")
  })

  it("能根据角色性别与年龄段自适应生成声学基频与 DSP 滤波器配置", () => {
    const elder = VoicePreviewEngine.deriveDefaultProfile("赵家长老", "male", "elder")
    expect(elder.pitch).toBeLessThan(1.0)
    expect(elder.timbreFilter).toBe("villain_lowpass")

    const femaleYouth = VoicePreviewEngine.deriveDefaultProfile("苏清月", "female", "youth")
    expect(femaleYouth.pitch).toBeGreaterThan(1.1)
  })
})

