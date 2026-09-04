import { describe, it, expect } from "vitest"
import { AuthorOpsEngine } from "./AuthorOpsEngine"
import type { MetricLogEntry } from "../types"

describe("AuthorOpsEngine (连载运营台账与作者商业名片)", () => {
  it("精准计算留存差分梯度，识别流失率>=12%的严重断崖章节", () => {
    const logs: MetricLogEntry[] = [
      {
        date: "2026-09-01",
        chasingReadCount: 5000,
        averageSubscription: 3000,
        retentionRate: 85,
        dropOffChapter: 10,
        dropOffReason: "正常自然流失",
        counterAction: "维持节奏",
      },
      {
        date: "2026-09-02",
        chasingReadCount: 3800,
        averageSubscription: 2500,
        retentionRate: 68, // 留存暴跌 17%
        dropOffChapter: 11,
        dropOffReason: "主角被反派踩脸未及时反击",
        counterAction: "加速下章反杀",
      },
    ]

    const analyses = AuthorOpsEngine.analyzeDropOff(logs)
    expect(analyses.length).toBe(1)
    expect(analyses[0].isSevereCliff).toBe(true)
    expect(analyses[0].gradientLoss).toBe(17)
    expect(analyses[0].recommendedCounterAction).toContain("诚恳作话打补丁")
  })

  it("能规范生成包含版权作品总字数的商业品牌名片", () => {
    const card = AuthorOpsEngine.generateBusinessCard(
      "天蚕土豆",
      "白金作家",
      [{ title: "斗破苍穹", genre: "东方玄幻", totalWords: 5000000, status: "finished" }],
      "https://afdian.com/author"
    )
    expect(card).toContain("天蚕土豆")
    expect(card).toContain("500 万字")
    expect(card).toContain("《斗破苍穹》")
  })
})
