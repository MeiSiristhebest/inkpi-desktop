import { describe, expect, it } from 'vitest'
import { buildGroundedPluginInput, validatePluginReview } from './pluginAnalysis'

describe('plugin source and response contracts', () => {
  it('supplies the actual ending and declares the omitted middle', () => {
    const text = '开头' + '甲'.repeat(8000) + '真正结尾'
    const input = buildGroundedPluginInput('reader-simulator', { text })!
    expect(input.sources[0].text.startsWith('开头')).toBe(true)
    expect(input.sources.at(-1)?.text.endsWith('真正结尾')).toBe(true)
    expect(input.coverage[0]).toMatchObject({ totalCharacters: text.length, complete: false })
    expect(input.sources.reduce((n, s) => n + s.text.length, 0)).toBe(4000)
    for (const source of input.sources) {
      expect(text.slice(source.start, source.end)).toBe(source.text)
    }
    expect(JSON.stringify(input.input)).not.toContain('甲'.repeat(4001))
  })

  it('does not mutate the caller input or treat a numeric constraint as manuscript prose', () => {
    const original = { protagonistRank: 10, enemyRank: 20, compensatoryAssets: ['陷阱'] }
    const input = buildGroundedPluginInput('combat-sandbox', original)!
    expect(original).toEqual({ protagonistRank: 10, enemyRank: 20, compensatoryAssets: ['陷阱'] })
    expect(input.sources.find((s) => s.label === 'enemyRank')?.text).toBe('20')
    expect(input.rubric).toContain('constraints')
    expect(input.rubric).toContain('costs')
  })

  it('keeps extension inputs and the separate opening contract out of this contract', () => {
    expect(buildGroundedPluginInput('external-extension', { text: '例子' })).toBeNull()
    expect(buildGroundedPluginInput('gold-chapters-eval', { text: '例子' })).toBeNull()
  })

  const text = '她没有跪下，而是抵抗命令。🙂'
  const input = () => buildGroundedPluginInput('reader-simulator', { text })!
  const review = (extra = {}) =>
    JSON.stringify({
      findings: [
        {
          aspect: 'profile_interpretation',
          observation: '原文明确否定了跪下的动作',
          interpretation: '偏好反抗情节的假设读者可能认同该行为',
          recommendation: '结合该读者画像复核',
          evidence: [{ sourceId: 'text:0', start: 0, end: text.length, quote: text }],
          ...extra,
        },
      ],
      insufficientEvidence: ['未提供前文和真实读者数据'],
    })

  it('keeps observations separate from interpretations and uses exact UTF-16 source positions', () => {
    const result = validatePluginReview(review(), input())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error)
    expect(result.text).toContain('观察：原文明确否定')
    expect(result.text).toContain('模型解释：')
    expect(result.text).toContain(`「${text}」`)
    expect(result.text).toContain('证据不足：')
  })

  it.each([
    [{ sourceId: 'absent', start: 0, end: 2, quote: '她没' }],
    [{ sourceId: 'text:0', start: -1, end: 2, quote: '她没' }],
    [{ sourceId: 'text:0', start: 0.5, end: 2, quote: '她没' }],
    [{ sourceId: 'text:0', start: 0, end: 100, quote: text }],
    [{ sourceId: 'text:0', start: 0, end: text.length, quote: '她跪下了。' }],
    [],
  ])('rejects invented, absent, fractional, empty or out of range evidence %#', (evidence) => {
    expect(validatePluginReview(review({ evidence }), input()).ok).toBe(false)
  })

  it('rejects free text, unsupported aspects and an empty all-clear', () => {
    expect(validatePluginReview('剧情毫无问题', input()).ok).toBe(false)
    expect(validatePluginReview(review({ aspect: 'real_upvotes' }), input()).ok).toBe(false)
    expect(
      validatePluginReview(JSON.stringify({ findings: [], insufficientEvidence: [] }), input()).ok,
    ).toBe(false)
  })

  it('accepts an honest abstention without fabricating a finding', () => {
    const result = validatePluginReview(
      JSON.stringify({ findings: [], insufficientEvidence: ['缺少角色设定，无法判断逻辑矛盾'] }),
      input(),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toContain('缺少角色设定')
  })
})
