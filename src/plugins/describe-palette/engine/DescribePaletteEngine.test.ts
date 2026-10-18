import { describe, it, expect } from 'vitest'
import { DescribePaletteEngine } from './DescribePaletteEngine'
describe('Description retrieval and literal observations', () => {
  const engine = new DescribePaletteEngine()
  it('retains the existing curated collection and category filtering', () => {
    expect(engine.getAllSnippets().length).toBeGreaterThan(10)
    expect(engine.searchSnippets('剑芒').some((s) => s.text.includes('剑芒'))).toBe(true)
    expect(
      engine
        .searchSnippets('', { genre: 'xianxia' })
        .every((s) => s.genre === 'xianxia' || s.genre === 'all'),
    ).toBe(true)
    expect(
      engine
        .searchSnippets('', { sense: 'sound' })
        .every((s) => s.primarySense === 'sound' || s.secondarySenses?.includes('sound')),
    ).toBe(true)
  })
  it('does not grade sensory quality from lexical counts', () => {
    const report = engine.diagnoseText('没有看见光，也没有气味。')
    expect(report.radar.sight).toBeGreaterThan(0)
    expect(report).not.toHaveProperty('missingSenses')
    expect(report).not.toHaveProperty('dominantSense')
  })
  it('samples without replacement while honoring every query term', () => {
    const engine = new DescribePaletteEngine([
      {
        id: 'a',
        primarySense: 'sight',
        genre: 'all',
        category: '对象',
        keywords: ['树'],
        text: '树影',
      },
      {
        id: 'b',
        primarySense: 'sound',
        genre: 'all',
        category: '对象',
        keywords: ['树'],
        text: '树声',
      },
      {
        id: 'c',
        primarySense: 'touch',
        genre: 'all',
        category: '其他',
        keywords: ['石头'],
        text: '石头',
      },
    ])
    expect(
      engine.inspireRandom('all', undefined, 3, { next: () => 0 }, '树').map((s) => s.id),
    ).toEqual(['a', 'b'])
    expect(engine.searchSnippets('树 对象').map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('returns detached data rather than exposing internal mutable records', () => {
    const data = engine.getAllSnippets()
    data[0].keywords.push('unexpected')
    expect(engine.getAllSnippets()[0].keywords).not.toContain('unexpected')
  })
  it('rejects invalid limits and random sources explicitly', () => {
    expect(() => engine.searchSnippets('', { limit: -1 })).toThrow()
    expect(() => engine.inspireRandom(undefined, undefined, 1, { next: () => 1 })).toThrow()
  })
})
