import { describe, it, expect } from 'vitest'
import { NameForgeEngine } from './NameForgeEngine'
import type { RandomSource } from '../../../ports/randomSource'

describe('NameForgeEngine — 中西奇幻起名姬算法引擎', () => {
  const engine = new NameForgeEngine()

  it('generates chinese character names with high phonetics score', () => {
    const list = engine.generateNames({ category: 'character_cn', count: 5, style: 'cold_sharp' })
    expect(list.length).toBe(5)
    for (const item of list) {
      expect(item.name.length).toBeGreaterThanOrEqual(2)
      expect(item.phoneticsScore).toBeGreaterThanOrEqual(70)
      expect(item.meaningOrVibe).toBeTruthy()
    }
  })

  it('supports fixed surname prefix and generation style', () => {
    const list = engine.generateNames({
      category: 'character_cn',
      count: 3,
      fixedPrefix: '楚',
      style: 'ethereal',
    })
    expect(list.length).toBe(3)
    expect(list.every((item) => item.name.startsWith('楚'))).toBe(true)
  })

  it('generates western character names with first and last parts', () => {
    const list = engine.generateNames({
      category: 'character_western',
      count: 4,
      gender: 'female',
    })
    expect(list.length).toBe(4)
    expect(list.every((item) => item.name.includes('·'))).toBe(true)
  })

  it('generates sect and factions', () => {
    const list = engine.generateNames({ category: 'sect_faction', count: 3 })
    expect(list.length).toBe(3)
    expect(list[0].category).toBe('sect_faction')
  })

  it('generates techniques and spells', () => {
    const list = engine.generateNames({ category: 'technique_spell', count: 3 })
    expect(list.length).toBe(3)
    expect(list[0].category).toBe('technique_spell')
  })

  it('generates artifacts and locations', () => {
    const artifacts = engine.generateNames({ category: 'item_artifact', count: 3 })
    expect(artifacts.length).toBe(3)
    const locations = engine.generateNames({ category: 'location_realm', count: 3 })
    expect(locations.length).toBe(3)
  })

  it('works deterministically when given a mocked RandomSource', () => {
    const mockRng: RandomSource = {
      next: () => 0.1,
    }
    const res1 = engine.generateNames({ category: 'character_cn', count: 2 }, mockRng)
    const res2 = engine.generateNames({ category: 'character_cn', count: 2 }, mockRng)
    expect(res1[0].name).toEqual(res2[0].name)
  })
})
