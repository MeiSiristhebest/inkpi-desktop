import { describe, expect, it } from 'vitest'
import { ArchetypeEngine } from './ArchetypeEngine'
describe('optional archetype materials', () => {
  it('actually supplies all advertised categories and distinct cards', () => {
    const cards = ArchetypeEngine.getPresetArchetypes()
    expect(cards.filter((c) => c.category === 'character_archetype_36')).toHaveLength(36)
    expect(cards.filter((c) => c.category === 'mbti_matrix')).toHaveLength(16)
    expect(cards.filter((c) => c.category === 'narrative_motif_12')).toHaveLength(12)
    expect(cards.filter((c) => c.category === 'conflict_deck').length).toBeGreaterThan(0)
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
  })
  it('draws without duplicates and rejects invalid draw counts or random values', () => {
    const engine = new ArchetypeEngine({ next: () => 0 })
    const cards = engine.drawCards('character_archetype_36', 2)
    expect(new Set(cards.map((c) => c.id)).size).toBe(2)
    expect(() => engine.drawCards('character_archetype_36', -1)).toThrow()
    expect(() =>
      new ArchetypeEngine({ next: () => 1 }).drawCards('character_archetype_36'),
    ).toThrow()
  })
  it('does not turn card labels into a measured tension score or inevitable hostility', () => {
    const cards = ArchetypeEngine.getPresetArchetypes()
    const result = ArchetypeEngine.calculateChemistry(cards[0], cards[1])
    expect(result).not.toHaveProperty('tensionScore')
    expect(result.dramaticPrompt).not.toMatch(/天然宿敌|不可调和|必然/)
  })
})
