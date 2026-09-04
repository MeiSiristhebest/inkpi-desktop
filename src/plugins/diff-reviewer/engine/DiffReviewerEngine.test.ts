import { describe, it, expect } from "vitest"
import { DiffReviewerEngine } from "./DiffReviewerEngine"

describe("DiffReviewerEngine (双栏审校与合稿引擎)", () => {
  const original = `第1章 惊变
林凡握住生锈的铁剑，冷冷看着面前的黑衣人。
天空中下着暴雨，电闪雷鸣。
黑衣人冷笑一声，拔出腰间的短刀。`

  const proposed = `第1章 惊变
林凡紧握着古朴的青铜断剑，眸光如冰注视着前方的刺客。
天空中暴雨倾盆，雷光划破夜幕。
黑衣人狞笑一声，拔出腰间的短刀。`

  it("基于 Myers 算法计算出精确的 Diff Hunk 并在行内拆分 Word 级标记", () => {
    const diffResult = DiffReviewerEngine.computeDiff(original, proposed)
    expect(diffResult.hunks.length).toBeGreaterThanOrEqual(1)
    expect(diffResult.stats.additions).toBeGreaterThan(0)
    expect(diffResult.stats.deletions).toBeGreaterThan(0)

    const firstHunk = diffResult.hunks[0]
    expect(firstHunk.resolution).toBe("pending")
    // 验证行内 wordTokens 存在
    const modifiedLine = firstHunk.lineChanges.find((l) => l.wordTokens && l.wordTokens.length > 0)
    expect(modifiedLine).toBeDefined()
  })

  it("能够对单 Hunk 独立执行 apply，产出替换后的合稿", () => {
    const diffResult = DiffReviewerEngine.computeDiff(original, proposed)
    expect(diffResult.hunks.length).toBeGreaterThan(0)

    // 采纳该 Hunk
    diffResult.hunks[0].resolution = "applied"
    const merged = DiffReviewerEngine.applyHunks(original, diffResult.hunks)

    expect(merged).toContain("青铜断剑")
    expect(merged).not.toContain("生锈的铁剑")
  })

  it("当 Hunk 被 rejected 时，合稿维持原样不变", () => {
    const diffResult = DiffReviewerEngine.computeDiff(original, proposed)
    diffResult.hunks[0].resolution = "rejected"
    const merged = DiffReviewerEngine.applyHunks(original, diffResult.hunks)

    expect(merged).toContain("生锈的铁剑")
    expect(merged).not.toContain("青铜断剑")
  })
})
