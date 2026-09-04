import { describe, it, expect } from "vitest"
import { MultiverseEngine } from "./MultiverseEngine"

describe("MultiverseEngine (平行宇宙因果沙盒推演器)", () => {
  const canonChapters = [
    { index: 13, title: "第13章 秘境试炼", summary: "主角进入太虚秘境寻宝", entities: ["林凡", "苏清月"] },
    { index: 14, title: "第14章 绝地救援", summary: "女配苏清月遭魔修偷袭重创", entities: ["林凡", "苏清月", "魔修"] },
    { index: 15, title: "第15章 生死抉择", summary: "林凡冒死救下苏清月，确立生死道侣盟友关系", entities: ["林凡", "苏清月"] },
    { index: 16, title: "第16章 宗门大比", summary: "苏清月家族为林凡提供九转丹药相助夺冠", entities: ["林凡", "苏清月"] },
    { index: 17, title: "第17章 远古遗迹", summary: "双人合璧破除诛仙剑阵", entities: ["林凡", "苏清月"] },
  ]

  it("正确在分歧奇点章节处创建分支并推演非线性蝴蝶效应扩散", () => {
    const forkIndex = 15
    const premise = "主角林凡并未出手救下苏清月，苏清月香消玉殒"

    const sim = MultiverseEngine.simulateFork(canonChapters, forkIndex, premise)

    expect(sim.forkChapterIndex).toBe(15)
    expect(sim.nodes.length).toBe(5)

    // 分歧点之前：偏离度为 0
    expect(sim.nodes[0].divergenceLevel).toBe(0)
    expect(sim.nodes[1].divergenceLevel).toBe(0)

    // 分歧点：偏离度为 0.35 并记录前提
    expect(sim.nodes[2].divergenceLevel).toBe(0.35)
    expect(sim.nodes[2].eventSummary).toContain("苏清月香消玉殒")

    // 分歧点之后：偏离度递增
    expect(sim.nodes[3].divergenceLevel).toBeGreaterThan(0.35)
    expect(sim.nodes[4].divergenceLevel).toBeGreaterThanOrEqual(sim.nodes[3].divergenceLevel)
    expect(sim.butterflyEffects.length).toBeGreaterThanOrEqual(3)
  })

  it("支持将推演结果创建为标准持久化 MultiverseBranchRecord", () => {
    const sim = MultiverseEngine.simulateFork(canonChapters, 15, "主角叛逃宗门")
    const record = MultiverseEngine.createBranchRecord("rec_1", "p1", sim, 100000)

    expect(record.id).toBe("rec_1")
    expect(record.projectId).toBe("p1")
    expect(record.forkChapterIndex).toBe(15)
    expect(record.nodes.length).toBe(5)
  })
})

