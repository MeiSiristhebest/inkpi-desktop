import { describe, it, expect } from 'vitest'
import { DescribePaletteEngine } from './DescribePaletteEngine'
describe('literal sensory search constraints', () => {
  it('honors an explicit empty custom collection and zero limit', () => {
    expect(new DescribePaletteEngine([]).getAllSnippets()).toEqual([])
    expect(new DescribePaletteEngine().searchSnippets('', { limit: 0 })).toEqual([])
  })
  it('keeps source spans and never diagnoses missing senses from absence of cues', () => {
    const text = '😀没有看见光，也没听见声音。'
    const report = new DescribePaletteEngine().diagnoseText(text)
    expect(report.totalWordCount).toBe(Array.from(text).length)
    expect(report).not.toHaveProperty('missingSenses')
    for (const m of report.matches) expect(text.slice(m.start, m.end)).toBe(m.quote)
  })
  it('does not use an empty keyword to match arbitrary searches', () => {
    const data = [
      {
        id: '1',
        primarySense: 'sight' as const,
        genre: 'all' as const,
        category: '',
        keywords: [''],
        text: '实际素材',
      },
    ]
    expect(new DescribePaletteEngine(data).searchSnippets('不存在')).toEqual([])
  })
})
