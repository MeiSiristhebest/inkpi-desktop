import { describe, it, expect } from 'vitest'
import { NameForgeEngine } from './NameForgeEngine'
import { PhoneticsEvaluator } from './PhoneticsEvaluator'
describe('author naming and pronunciation constraints', () => {
  it('does not guess unknown tones from Unicode parity or score an empty name', () => {
    expect(PhoneticsEvaluator.getTone('😀')).toBe('unknown')
    expect(PhoneticsEvaluator.evaluatePhonetics('')).not.toHaveProperty('score')
    expect(PhoneticsEvaluator.getTonePattern('😀')).toBe('?')
  })
  it('honors zero count and rejects fractional or negative counts', () => {
    const engine = new NameForgeEngine({ next: () => 0.2 })
    expect(engine.generateNames({ category: 'character_cn', count: 0 })).toEqual([])
    expect(() => engine.generateNames({ category: 'character_cn', count: -1 })).toThrow()
    expect(() => engine.generateNames({ category: 'character_cn', count: 1.5 })).toThrow()
  })
  it('applies literal prefix, required core, excluded names and length constraints', () => {
    const engine = new NameForgeEngine({ next: () => 0.2 })
    const results = engine.generateNames({
      category: 'character_cn',
      count: 3,
      fixedPrefix: '李',
      fixedKern: '😀',
      minLength: 3,
      maxLength: 3,
      excludedNames: ['李😀寒'],
    } as any)
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(result.name.startsWith('李')).toBe(true)
      expect(result.name).toContain('😀')
      expect(Array.from(result.name)).toHaveLength(3)
      expect(result.name).not.toBe('李😀寒')
      expect(result).not.toHaveProperty('phoneticsScore')
    }
  })
})
