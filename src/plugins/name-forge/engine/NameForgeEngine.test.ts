import { describe, it, expect } from 'vitest'
import { NameForgeEngine } from './NameForgeEngine'
import { PhoneticsEvaluator as phonetics } from './PhoneticsEvaluator'
describe('Naming constraints and supplied readings', () => {
  const engine = new NameForgeEngine()
  it('produces distinct candidates in each supported category', () => {
    for (const category of [
      'character_cn',
      'character_western',
      'sect_faction',
      'technique_spell',
      'item_artifact',
      'location_realm',
    ] as const) {
      const items = engine.generateNames({ category, count: 3 })
      expect(items).toHaveLength(3)
      expect(new Set(items.map((i) => i.name)).size).toBe(3)
      for (const item of items) expect(item).not.toHaveProperty('phoneticsScore')
    }
  })
  it('keeps required literal prefixes and cores in western and Chinese modes', () => {
    for (const category of ['character_cn', 'character_western'] as const) {
      const items = engine.generateNames({
        category,
        count: 1,
        fixedPrefix: '作者',
        fixedKern: '星',
      })
      expect(items[0].name.startsWith('作者')).toBe(true)
      expect(items[0].name).toContain('星')
    }
  })
  it('is bounded with a deterministic source and excludes exact existing names', () => {
    const random = { next: () => 0.1 }
    const first = engine.generateNames({ category: 'character_cn', count: 3 }, random)
    expect(first).toHaveLength(1)
    expect(
      engine.generateNames(
        { category: 'character_cn', count: 1, excludedNames: [first[0].name] },
        random,
      ),
    ).toEqual([])
  })
  it('groups only the supplied readings and tests adjacent alternation correctly', () => {
    expect(phonetics.getTone('甲')).toBe('unknown')
    expect(phonetics.getTone('甲', 1)).toBe('ping')
    expect(phonetics.getTone('甲', 4)).toBe('ze')
    expect(phonetics.analyzeToneFluctuation('楚凌霄', [3, 2, 1])).toMatchObject({
      pattern: '仄平平',
      isAlternating: false,
      cadence: 'ping',
      knownToneCount: 3,
    })
    expect(phonetics.analyzeToneFluctuation('甲乙丙', [1, 3, 2]).isAlternating).toBe(true)
    expect(phonetics.analyzeToneFluctuation('甲乙', [1, null]).isAlternating).toBeNull()
  })
  it('distinguishes repeated characters from pronunciation judgments', () => {
    const report = phonetics.evaluatePhonetics('云云', [2, 2])
    expect(report.hasAdjacentIdentical).toBe(true)
    expect(report).not.toHaveProperty('score')
    expect(() => phonetics.evaluatePhonetics('甲乙', [1])).toThrow()
  })
})
