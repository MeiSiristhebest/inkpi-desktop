import { describe, expect, it } from 'vitest'
import { SafeGateEngine } from './SafeGateEngine'
import type { SensitiveWord } from '../types'

const word = (id: string, text: string): SensitiveWord => ({
  id,
  word: text,
  level: 'blue',
  category: '作者词表',
  literaryAlternatives: [{ replacement: `[${id}]`, genre: ['neutral'], confidence: 0.1 }],
})

describe('SafeGate source and rule boundaries', () => {
  it('finishes zero-length Unicode regex matches without emitting deletions', () => {
    const engine = new SafeGateEngine()
    engine.build(
      [],
      [
        {
          id: 'empty',
          pattern: '(?:)',
          flags: 'u',
          level: 'blue',
          category: '词表',
          literaryAlternatives: [],
        },
      ],
    )
    const result = engine.scan('😀x')
    expect(result.violations).toHaveLength(0)
    expect(result.complete).toBe(false)
    expect(result.ruleErrors).toHaveLength(1)
  })
  it('reports invalid rules instead of a completed clean scan', () => {
    const engine = new SafeGateEngine()
    engine.build(
      [],
      [
        {
          id: 'bad',
          pattern: '[',
          flags: '',
          level: 'blue',
          category: '词表',
          literaryAlternatives: [],
        },
      ],
    )
    const result = engine.scan('没有命中')
    expect(result.isClean).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.ruleErrors).toEqual([expect.objectContaining({ ruleId: 'bad' })])
  })
  it('retains overlapping author rules and refuses ambiguous batch edits', () => {
    const engine = new SafeGateEngine()
    engine.build([word('one', '青铜'), word('two', '铜门')], [])
    const text = '青铜门'
    const result = engine.scan(text)
    expect(result.violations).toHaveLength(2)
    expect(engine.applyAllAuto(text, result)).toBe(text)
  })
  it('refuses stale and malformed source intervals before any replacement', () => {
    const engine = new SafeGateEngine()
    engine.build([word('one', '青铜'), word('two', '铜门')], [])
    const result = engine.scan('青铜与铜门')
    expect(
      engine.applyReplacement(
        '玉石与铜门',
        result.violations[0],
        result.violations[0].suggestions[0],
      ),
    ).toBe('玉石与铜门')
    expect(engine.applyAllAuto('玉石与铜门', result)).toBe('玉石与铜门')
    expect(
      engine.applyReplacement(
        '青铜与铜门',
        { ...result.violations[0], startIndex: 1.5 },
        result.violations[0].suggestions[0],
      ),
    ).toBe('青铜与铜门')
  })
  it('matches supplementary characters using exact UTF16 spans', () => {
    const engine = new SafeGateEngine()
    engine.build([word('emoji', '😀门')], [])
    const text = '😀😀门'
    const result = engine.scan(text)
    expect(result.violations).toEqual([
      expect.objectContaining({ startIndex: 2, endIndex: 5, matchedText: '😀门' }),
    ])
  })
})
