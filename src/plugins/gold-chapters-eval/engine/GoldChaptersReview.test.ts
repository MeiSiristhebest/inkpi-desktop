import { describe, expect, it } from 'vitest'
import { GoldChaptersEngine } from './GoldChaptersEngine'
import { validateGoldReview } from './GoldChaptersReview'

const text = '她要把失散的孩子带回家。'
const input = GoldChaptersEngine.buildAnalysisInput(text)
const finding = {
  dimension: 'motivation',
  observation: '角色计划寻找孩子',
  interpretation: '寻找孩子可能是当前行动的动机',
  recommendation: '可保留这一目标',
  evidence: [{ sourceId: 'excerpt-0', start: 0, end: text.length, quote: text }],
}
const response = (item: unknown = finding) =>
  JSON.stringify({ findings: [item], insufficientEvidence: [] })

describe('grounded opening review', () => {
  it('keeps explicit text, interpretation, and advice separate after citation validation', () => {
    const result = validateGoldReview(response(), input)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error(result.error)
    expect(result.text).toContain(`原文 [0, ${text.length})：「${text}」`)
    expect(result.text).toContain('观察：角色计划寻找孩子')
    expect(result.text).toContain('模型解释：寻找孩子可能是当前行动的动机')
    expect(result.text).toContain('修改建议：可保留这一目标')
  })

  it.each([
    { sourceId: 'unknown', start: 0, end: text.length, quote: text },
    { sourceId: 'excerpt-0', start: 0, end: text.length, quote: '她要复仇。' },
    { sourceId: 'excerpt-0', start: -1, end: text.length, quote: text },
    { sourceId: 'excerpt-0', start: 0.5, end: text.length, quote: text },
    { sourceId: 'excerpt-0', start: 0, end: text.length + 1, quote: text },
    { sourceId: 'excerpt-0', start: 0, end: 0, quote: '' },
  ])('rejects an unbound or malformed quote: %j', (evidence) => {
    expect(validateGoldReview(response({ ...finding, evidence: [evidence] }), input)).toMatchObject(
      { ok: false },
    )
  })

  it('rejects unsupported conclusions and malformed output instead of falling back to free text', () => {
    for (const raw of [
      '开篇非常好，91 分。',
      'null',
      '{}',
      response({ ...finding, evidence: [] }),
      response({ ...finding, dimension: 'signing_probability' }),
      response({ ...finding, interpretation: null }),
      JSON.stringify({ findings: [], insufficientEvidence: [] }),
    ]) {
      expect(validateGoldReview(raw, input)).toMatchObject({ ok: false })
    }
  })

  it('allows an explicit abstention without pretending the text passed', () => {
    expect(
      validateGoldReview(
        JSON.stringify({
          findings: [],
          insufficientEvidence: ['未提供其余章节，不能判断目标是否持续推进'],
        }),
        input,
      ),
    ).toMatchObject({ ok: true, text: expect.stringContaining('证据不足：') })
  })

  it('includes the actual ending excerpt and counts overlapping ranges once', () => {
    const short = GoldChaptersEngine.buildAnalysisInput('文'.repeat(3200))
    expect(short.sources).toHaveLength(1)
    expect(short.coverage).toEqual({
      totalCharacters: 3200,
      suppliedCharacters: 3200,
      complete: true,
    })
    const longText = '甲'.repeat(5000) + '这是结尾。'
    const long = GoldChaptersEngine.buildAnalysisInput(longText)
    expect(long.sources).toHaveLength(2)
    expect(long.coverage).toEqual({
      totalCharacters: longText.length,
      suppliedCharacters: 3500,
      complete: false,
    })
    const source = long.sources[1]
    const quote = '这是结尾。'
    const start = source.text.indexOf(quote)
    const result = validateGoldReview(
      response({
        ...finding,
        evidence: [{ sourceId: source.id, start, end: start + quote.length, quote }],
      }),
      long,
    )
    expect(result).toMatchObject({ ok: true, text: expect.stringContaining('未检查省略部分') })
    if (!result.ok) throw new Error(result.error)
    expect(result.text).toContain(`原文 [5000, ${longText.length})`)
  })

  it('uses the same UTF-16 offset convention for emoji and Chinese', () => {
    const sourceText = '🌙她要找孩子。'
    const result = validateGoldReview(
      response({
        ...finding,
        evidence: [
          { sourceId: 'excerpt-0', start: 2, end: sourceText.length, quote: '她要找孩子。' },
        ],
      }),
      GoldChaptersEngine.buildAnalysisInput(sourceText),
    )
    expect(result).toMatchObject({ ok: true, text: expect.stringContaining('原文 [2, 8)') })
  })
})
