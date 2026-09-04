import { describe, it, expect } from "vitest"
import { ArchetypeEngine } from "./ArchetypeEngine"

describe("ArchetypeEngine (人格原型与母题抽卡引擎)", () => {
  it("抽卡能根据指定分类准确抽取预设卡牌", () => {
    const engine = new ArchetypeEngine({ next: () => 0.1 })
    const cards = engine.drawCards("character_archetype_36", 2)

    expect(cards.length).toBe(2)
    expect(cards[0].category).toBe("character_archetype_36")
    expect(cards[0].name).toBeDefined()
  })

  it("当两角色为天然宿敌原型时，计算出极高的冲突张力火花", () => {
    const presets = ArchetypeEngine.getPresetArchetypes()
    const rebel = presets.find((p) => p.id === "arch-rebel")!
    const ruler = presets.find((p) => p.id === "arch-ruler")!

    const chem = ArchetypeEngine.calculateChemistry(rebel, ruler)
    expect(chem.tensionScore).toBeGreaterThanOrEqual(0.9)
    expect(chem.dramaticPrompt).toContain("天然宿敌碰撞")
  })
})
