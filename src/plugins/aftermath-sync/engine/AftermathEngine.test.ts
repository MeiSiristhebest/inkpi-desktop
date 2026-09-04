import { describe, it, expect } from "vitest"
import { AftermathEngine } from "./AftermathEngine"
import type { EntityCandidate } from "../types"

describe("AftermathEngine (章后桥段设定回写器)", () => {
  const mockEntities: EntityCandidate[] = [
    { id: "c1", name: "林凡", category: "character", currentTier: "练气九层" },
    { id: "c2", name: "苏雨柔", category: "character", currentTier: "筑基初期" },
    { id: "i1", name: "九幽冰魄剑", category: "item", currentOwner: "神秘人" },
  ]

  it("当章节正文描写角色突破时，精准生成境界升级提案", () => {
    const text = `林凡盘膝而坐，周身灵气奔涌如潮。轰然一声巨响，林凡一举迈入筑基初期！`
    const result = AftermathEngine.analyzeChapter(text, "ch1", 1, mockEntities)

    expect(result.summary.attributeUpdates).toBe(1)
    expect(result.patches[0].entityName).toBe("林凡")
    expect(result.patches[0].propertyName).toBe("战力境界")
    expect(result.patches[0].beforeValue).toBe("练气九层")
    expect(result.patches[0].afterValue).toBe("筑基初期")
  })

  it("当检测到法宝易主时，生成所有权转移有向补丁", () => {
    const text = `大战落幕，林凡缓步上前，伸手夺得九幽冰魄剑。`
    const result = AftermathEngine.analyzeChapter(text, "ch2", 2, mockEntities)

    expect(result.summary.ownershipTransfers).toBe(1)
    expect(result.patches[0].changeType).toBe("ownership_transfer")
    expect(result.patches[0].entityName).toBe("九幽冰魄剑")
    expect(result.patches[0].afterValue).toBe("林凡")
  })
})
