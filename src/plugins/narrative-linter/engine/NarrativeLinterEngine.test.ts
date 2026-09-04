import { describe, it, expect } from "vitest"
import { NarrativeLinterEngine } from "./NarrativeLinterEngine"

describe("NarrativeLinterEngine (360+文学质量与人设门禁)", () => {
  const engine = new NarrativeLinterEngine()

  it("当单句密集堆叠 3 个以上副词时，触发副词堆叠警告并提供 QuickFix", () => {
    const text = "林凡狠狠地咬牙，愤怒地拔剑，快速地朝敌人斩去。"
    const result = engine.lint(text)
    expect(result.warningCount).toBeGreaterThanOrEqual(3)
    const adv = result.issues.find((i) => i.ruleId === "LINT_ADVERB_STACK")
    expect(adv).toBeDefined()
    expect(adv?.quickFix).toBeDefined()

    if (adv) {
      const fixed = NarrativeLinterEngine.applyQuickFix(text, adv)
      expect(fixed).not.toContain(adv.matchedSnippet)
    }
  })

  it("当台词长篇大论背书并说教时，触发 DialogueInfodump 严重错误", () => {
    const text = `苏雨柔叹了口气说道：“正如你所知，我们这个世界的灵气分为九层境界，每一层都有严格的灵压差，换言之，这个世界的法则是不允许越级挑战的。”`
    const result = engine.lint(text)
    expect(result.errorCount).toBeGreaterThanOrEqual(1)
    const dump = result.issues.find((i) => i.ruleId === "LINT_DIALOGUE_INFODUMP")
    expect(dump).toBeDefined()
    expect(dump?.severity).toBe("error")
  })

  it("当出现突兀现代工业网络热词时，触发 Anachronism 拦截", () => {
    const text = "老祖微微一笑，此法宝乃是上古密卷所制，性价比极高，完全是降维打击。"
    const result = engine.lint(text)
    expect(result.errorCount).toBeGreaterThanOrEqual(2)
    const matches = result.issues.filter((i) => i.ruleId === "LINT_ANACHRONISM")
    expect(matches.length).toBe(2)
    expect(matches.map((m) => m.matchedSnippet)).toContain("性价比")
    expect(matches.map((m) => m.matchedSnippet)).toContain("降维打击")
  })

  it("计算科学扣分的文学清洁度指数", () => {
    const cleanText = "晨光熹微。林凡收起长剑，向山下走去。"
    const cleanResult = engine.lint(cleanText)
    expect(cleanResult.cleanScore).toBe(100)

    const dirtyText = "这简直是降维打击。林凡狠狠地愤怒地快速地冲过去。"
    const dirtyResult = engine.lint(dirtyText)
    expect(dirtyResult.cleanScore).toBeLessThan(80)
  })
})
