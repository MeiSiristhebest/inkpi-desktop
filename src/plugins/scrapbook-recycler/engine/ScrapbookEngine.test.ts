import { describe, it, expect } from "vitest"
import { ScrapbookEngine } from "./ScrapbookEngine"
import type { ScrapbookFragmentRecord } from "../types"

describe("ScrapbookEngine (废稿灵感碎纸机回收站)", () => {
  it("自动从文本修改中萃取被删除的大于等于15字的废稿切片", () => {
    const oldText = "林凡手持残破铁剑，在暴雨中冷冷前行，浑身浴血杀意凛然。他一步踏入山门。"
    const newText = "林凡缓步走入山门。"

    const extracted = ScrapbookEngine.extractDeletedFragments(oldText, newText, "ch1", "第一章 杀戮")
    expect(extracted.length).toBe(1)
    expect(extracted[0].wordCount).toBeGreaterThanOrEqual(15)
    expect(extracted[0].snippet).toContain("手持残破铁剑")
    expect(extracted[0].sourceChapterId).toBe("ch1")
  })

  it("当删除字符数少于15字时，判定为微小编辑，不污染废稿池", () => {
    const oldText = "林凡微微一笑道。"
    const newText = "林凡冷笑道。"
    const extracted = ScrapbookEngine.extractDeletedFragments(oldText, newText)
    expect(extracted.length).toBe(0)
  })

  it("基于余弦相似度推荐与当前章节情境最相关的历史废稿", () => {
    const fragments: ScrapbookFragmentRecord[] = [
      {
        id: "f1",
        projectId: "p1",
        snippet: "夜色浓稠如墨，狂风撕扯着古刹的破旧幡旗，雷光照亮了黑衣人的狰狞面孔。",
        wordCount: 35,
        deletedAt: 1000,
        tags: ["夜色", "狂风", "古刹", "雷光"],
        isReused: false,
      },
      {
        id: "f2",
        projectId: "p1",
        snippet: "这盘青玉糕甜而不腻，入口即化，乃是天香阁掌柜特意为公主烹调的点心。",
        wordCount: 34,
        deletedAt: 2000,
        tags: ["青玉糕", "天香阁", "点心"],
        isReused: false,
      },
    ]

    const contextText = "黑衣刺客潜伏在古刹周围，等待狂风暴雨的降临。"
    const recs = ScrapbookEngine.recommendFragments(contextText, fragments)

    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].fragment.id).toBe("f1")
    expect(recs[0].matchedKeywords).toContain("狂风")
  })
})
