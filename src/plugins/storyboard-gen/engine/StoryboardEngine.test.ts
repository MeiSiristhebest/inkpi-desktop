import { describe, it, expect } from "vitest"
import { StoryboardEngine } from "./StoryboardEngine"

describe("StoryboardEngine (角色立绘与分镜生成器)", () => {
  it("能自动解析高潮冲突并输出完整的起承转合 4 格电影分镜", () => {
    const res = StoryboardEngine.extractStoryboard(
      "ch_01",
      "第一章 退婚死斗",
      "演武场上，风雷呼啸。赵家长老一刀劈下，林凡暴起反杀！"
    )

    expect(res.frames.length).toBe(4)
    expect(res.frames[0].shotType).toBe("establishing_wide")
    expect(res.frames[1].shotType).toBe("medium_confrontation")
    expect(res.frames[2].shotType).toBe("dutch_closeup")
    expect(res.frames[3].shotType).toBe("impact_wide")

    expect(res.suggestedCharacters.length).toBeGreaterThanOrEqual(2)
    expect(res.suggestedCharacters[0].characterName).toBe("林凡")
  })

  it("能正确将分镜提取结果打包为持久化 StoryboardSceneRecord", () => {
    const extracted = StoryboardEngine.extractStoryboard("ch_02", "第二章", "测试对决")
    const record = StoryboardEngine.createSceneRecord("sb_02", "p1", "ch_02", extracted, 123456)

    expect(record.id).toBe("sb_02")
    expect(record.projectId).toBe("p1")
    expect(record.chapterId).toBe("ch_02")
    expect(record.shotFrames.length).toBe(4)
  })
})

