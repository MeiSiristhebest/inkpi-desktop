import { describe, it, expect } from 'vitest'
import { NarrativeLinterEngine } from './NarrativeLinterEngine'

describe('NarrativeLinterEngine (规则模型门禁)', () => {
  const engine = new NarrativeLinterEngine()

  it('当单句密集堆叠 3 个以上副词时，触发副词堆叠警告并提供 QuickFix', () => {
    const text = '林凡狠狠地咬牙，愤怒地拔剑，快速地朝敌人斩去。'
    const result = engine.lint(text)
    expect(result.warningCount).toBeGreaterThanOrEqual(3)
    const adv = result.issues.find((i) => i.ruleId === 'LINT_ADVERB_STACK')
    expect(adv).toBeDefined()
    expect(adv?.quickFix).toBeDefined()

    if (adv) {
      const fixed = NarrativeLinterEngine.applyQuickFix(text, adv)
      expect(fixed).not.toContain(adv.matchedSnippet)
    }
  })

  it('长对白按长度定位，不推断角色声音失真', () => {
    const text = `苏雨柔说道：“${'世界的规则尚不清楚。'.repeat(12)}”`
    const result = engine.lint(text)
    expect(result.infoCount).toBe(1)
    const dump = result.issues.find((i) => i.ruleId === 'LINT_DIALOGUE_INFODUMP')
    expect(dump).toBeDefined()
    expect(dump?.severity).toBe('info')
    expect(dump?.matchedSnippet).toBe(text.slice(dump!.startOffset, dump!.endOffset))
  })

  it('只定位作者明确启用的词表', () => {
    const text = '老祖微微一笑，此法宝乃是上古密卷所制，性价比极高，完全是降维打击。'
    const configs = NarrativeLinterEngine.getDefaultRules().map((rule) =>
      rule.ruleId === 'LINT_ANACHRONISM' ? { ...rule, enabled: true } : rule,
    )
    const result = engine.lint(text, configs)
    expect(result.infoCount).toBe(2)
    const matches = result.issues.filter((i) => i.ruleId === 'LINT_ANACHRONISM')
    expect(matches.length).toBe(2)
    expect(matches.map((m) => m.matchedSnippet)).toContain('性价比')
    expect(matches.map((m) => m.matchedSnippet)).toContain('降维打击')
  })

  it('返回实际命中数而不生成文学得分', () => {
    const cleanText = '晨光熹微。林凡收起长剑，向山下走去。'
    const cleanResult = engine.lint(cleanText)
    expect(cleanResult.totalIssues).toBe(0)
    expect(cleanResult).not.toHaveProperty('cleanScore')

    const dirtyText = '这简直是降维打击。林凡狠狠地愤怒地快速地冲过去。'
    const dirtyResult = engine.lint(dirtyText)
    expect(dirtyResult.warningCount).toBe(3)
  })
})
