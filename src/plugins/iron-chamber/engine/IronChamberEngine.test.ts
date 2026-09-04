import { describe, it, expect } from "vitest"
import { IronChamberEngine } from "./IronChamberEngine"
import type { IronChamberRecord } from "../types"

describe("IronChamberEngine (黑曜石小黑屋契约引擎)", () => {
  const baseRecord: IronChamberRecord = {
    id: "ic-1",
    projectId: "p1",
    mode: "words",
    targetWords: 1000,
    targetMinutes: 30,
    startWords: 500,
    currentWords: 500,
    status: "locked",
    pledgedAt: 100000,
  }

  it("当模式为字数目标时，未达标拒绝解锁，达标后批准解锁", () => {
    // 增量 300 字，目标 1000 字
    const unfulfilled = IronChamberEngine.transitionToUnlock(baseRecord, 800, 100000)
    expect(unfulfilled.canUnlock).toBe(false)
    expect(unfulfilled.nextStatus).toBe("locked")

    // 增量 1100 字，达标
    const fulfilled = IronChamberEngine.transitionToUnlock(baseRecord, 1600, 100000)
    expect(fulfilled.canUnlock).toBe(true)
    expect(fulfilled.nextStatus).toBe("completed")
  })

  it("当模式为倒计时目标时，按流逝秒数判定达成", () => {
    const timeRecord: IronChamberRecord = {
      ...baseRecord,
      mode: "minutes",
      targetMinutes: 20, // 1200 秒
    }

    // 刚过 600 秒
    const mid = IronChamberEngine.calculateProgress(timeRecord, 500, 100000 + 600 * 1000)
    expect(mid.isFulfilled).toBe(false)
    expect(mid.timePercentage).toBe(50)

    // 达到 1201 秒
    const done = IronChamberEngine.calculateProgress(timeRecord, 500, 100000 + 1201 * 1000)
    expect(done.isFulfilled).toBe(true)
    expect(done.timePercentage).toBe(100)
  })

  it("紧急脱逃反思验证，字数不足被拦截", () => {
    const bad = IronChamberEngine.validateEmergencyAbort("太累了不想写")
    expect(bad.valid).toBe(false)
    expect(bad.error).toContain("不得少于15字")

    const good = IronChamberEngine.validateEmergencyAbort("突发紧急事务需要处理，稍后回来补齐今日所欠字数")
    expect(good.valid).toBe(true)
  })
})
