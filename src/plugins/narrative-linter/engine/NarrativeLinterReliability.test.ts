import { describe, expect, it } from 'vitest'
import { NarrativeLinterEngine } from './NarrativeLinterEngine'

describe('NarrativeLinter measured rules', () => {
  const engine = new NarrativeLinterEngine()
  it('honors explicit rule selection and author thresholds with exact CRLF offsets', () => {
    const text = '第一行\r\n第二行。\r\n😀' + '字'.repeat(14)
    const result = engine.lint(text, [
      {
        ruleId: 'LINT_RUN_ON_SENTENCE',
        name: '句长',
        enabled: true,
        severity: 'info',
        description: '',
        options: { maxClauseLength: 10 },
      },
    ])
    expect(result.issues).toHaveLength(1)
    const issue = result.issues[0]
    expect(issue.startOffset).toBe(text.indexOf('😀'))
    expect(issue.matchedSnippet).toBe(text.slice(issue.startOffset, issue.endOffset))
    expect(issue.severity).toBe('info')
  })
  it('does not infer anachronism or literary quality without author rules', () => {
    const result = engine.lint('数据中心以大数据计算性价比。')
    expect(result.issues).toHaveLength(0)
    expect(result).not.toHaveProperty('cleanScore')
  })
  it('does not apply a deletion to changed text', () => {
    const text = '狠狠地愤怒地快速地冲过去。'
    const issue = engine.lint(text).issues.find((entry) => entry.quickFix)!
    const changed = '缓缓地' + text.slice(3)
    expect(NarrativeLinterEngine.applyQuickFix(changed, issue)).toBe(changed)
  })
})
