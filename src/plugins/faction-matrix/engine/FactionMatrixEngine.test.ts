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
  updatedAt: 0,
})
describe('FactionMatrixEngine', () => {
  it('keeps absent relationships unknown instead of neutral', () => {
    const r = engine.simulateEventRipple(factions, [], 'a', 30)
    expect(r.ripples.every((entry) => entry.change === null && entry.status === 'unknown')).toBe(
      true,
    )
  })
  it('rejects missing endpoints, duplicate records and nonfinite coefficients', () => {
    expect(
      engine.validateGraph(factions, [rel('a', 'missing', 'friendly')]).length,
    ).toBeGreaterThan(0)
    expect(
      engine.validateGraph(factions, [rel('a', 'b', 'friendly'), rel('b', 'a', 'hostile')]).length,
    ).toBeGreaterThan(0)
    expect(() =>
      engine.simulateEventRipple(
        factions,
        [{ ...rel('a', 'b', 'friendly'), rippleCoefficient: Infinity, rippleRationale: '假设' }],
        'a',
        2,
      ),
    ).toThrow()
  })
  it('keeps an unknown baseline unknown when a delta can be computed', () => {
    const r = engine.simulateEventRipple(
      [factions[0], { id: 'b', name: 'b' }],
      [{ ...rel('a', 'b', 'friendly'), rippleCoefficient: -0.5, rippleRationale: '作者假设' }],
      'a',
      20,
    )
    expect(r.ripples[0]).toMatchObject({ change: -10, newReputation: null })
  })
})
