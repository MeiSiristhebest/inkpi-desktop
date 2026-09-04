import { describe, it, expect } from "vitest"
import { PovGuardEngine } from "./PovGuardEngine"
import type { EpistemicContext } from "./PovGuardEngine"

describe("PovGuardEngine (POV心智防火墙)", () => {
  const mockContext: EpistemicContext = {
    povCharacter: "林凡",
    povMode: "third_limited",
    allCharacters: [
      {
        characterId: "c-lin",
        characterName: "林凡",
        knownSecretIds: ["s-ring"],
      },
      {
        characterId: "c-su",
        characterName: "苏雨柔",
        knownSecretIds: ["s-poison", "s-reincarnation"],
      },
      {
        characterId: "c-elder",
        characterName: "白眉长老",
        knownSecretIds: ["s-poison"],
      },
    ],
    secrets: [
      {
        id: "s-poison",
        title: "噬灵绝命丹",
        confidentialityLevel: "top_secret",
        originChapterOrder: 5,
        holders: ["苏雨柔", "白眉长老"],
      },
      {
        id: "s-ring",
        title: "青铜古戒的来历",
        confidentialityLevel: "secret",
        originChapterOrder: 1,
        holders: ["林凡"],
      },
    ],
  }

  it("当检测到非POV角色的内部心理独白时，精准识别Head-Hopping并告警", () => {
    const text = `林凡握紧手中长剑，冷冷注视着前方的红衣少女。
苏雨柔心中暗想：此子修为竟然突破如此之快，绝不能让他活着离开秘境。
林凡深吸一口气，一步踏出。`

    const result = PovGuardEngine.analyze(text, mockContext)
    expect(result.headHoppingCount).toBe(1)
    expect(result.violations.length).toBe(1)
    expect(result.violations[0].type).toBe("head_hopping")
    expect(result.violations[0].characterName).toBe("苏雨柔")
    expect(result.violations[0].explanation).toContain("视角跳跃(Head-Hopping)")
  })

  it("当POV角色尚未获知机密却在正文直呼该机密时，标记全知泄漏", () => {
    const text = `林凡在林间穿行，忽然发现地上有一滩泛着紫芒的药液，他心中冷笑，这正是噬灵绝命丹的残留。`

    const result = PovGuardEngine.analyze(text, mockContext)
    expect(result.leakageCount).toBe(1)
    const leak = result.violations.find((v) => v.type === "omniscience_leak")
    expect(leak).toBeDefined()
    expect(leak?.snippet).toContain("噬灵绝命丹")
  })

  it("当POV模式为全知模式(omniscient)时，豁免所有视角与心理限制", () => {
    const text = `苏雨柔心中暗想：一定要杀了他。林凡此时也在心中盘算着退路。`
    const omniscientContext: EpistemicContext = {
      ...mockContext,
      povMode: "omniscient",
    }

    const result = PovGuardEngine.analyze(text, omniscientContext)
    expect(result.headHoppingCount).toBe(0)
    expect(result.leakageCount).toBe(0)
    expect(result.violations.length).toBe(0)
  })

  it("当POV角色已知机密时，正常叙述不触发泄漏告警", () => {
    const text = `林凡轻轻摸着青铜古戒的来历，心中思绪万千。`
    const result = PovGuardEngine.analyze(text, mockContext)
    expect(result.leakageCount).toBe(0)
  })
})
