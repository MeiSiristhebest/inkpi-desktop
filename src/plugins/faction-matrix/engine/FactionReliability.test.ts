import { describe, it, expect } from 'vitest'
import { factionMatrixEngine as engine } from './FactionMatrixEngine'
const factions = ['a', 'b', 'c'].map((id) => ({
  id,
  name: id,
  type: 'clan' as const,
  protagonistReputation: 10,
}))
const rel = (a: string, b: string, stance: string) => ({
  id: a + b,
  projectId: 'p',
  factionAId: a,
  factionAName: a,
  factionBId: b,
  factionBName: b,
  stance: stance as any,
  reputationScore: 0,
  updatedAt: 0,
})
describe('author relationship assumptions', () => {
  it('does not infer death orders or alliance facts from a number', () => {
    expect(engine.getReputationLevel(-90).desc).not.toContain('见之必杀')
    expect(engine.getReputationLevel(undefined as any).label).toBe('未记录')
  })
  it('does not predict a numeric ripple without an author coefficient', () => {
    const r = engine.simulateEventRipple(factions, [rel('a', 'b', 'allied')], 'a', -20)
    expect(r.ripples.find((r) => r.factionId === 'b')).toMatchObject({
      change: null,
      status: 'unknown',
    })
    const withAssumption = {
      ...rel('a', 'b', 'allied'),
      rippleCoefficient: 0.25,
      rippleRationale: '作者设定的条件假设',
    }
    const defined = engine.simulateEventRipple(factions, [withAssumption], 'a', -20)
    expect(defined.ripples.find((r) => r.factionId === 'b')).toMatchObject({
      change: -5,
      newReputation: 5,
      status: 'author_hypothesis',
    })
  })
  it('finds signed triads regardless of input permutation and does not call them contradictions', () => {
    const records = [
      rel('a', 'b', 'allied'),
      rel('a', 'c', 'friendly'),
      rel('b', 'c', 'mortal_enemy'),
    ]
    for (const ordering of [factions, [factions[2], factions[0], factions[1]]]) {
      const result = engine.detectStructuralParadoxes(ordering, records)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ status: 'review_candidate' })
    }
    expect(engine.detectStructuralParadoxes(factions, records.slice(0, 2))).toEqual([])
  })
})
