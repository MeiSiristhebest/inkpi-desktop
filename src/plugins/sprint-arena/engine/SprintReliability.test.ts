import { describe, expect, it } from 'vitest'
import { SprintEngine } from './SprintEngine'

describe('observed sprint timing', () => {
  const engine = new SprintEngine()
  it('smooths zero observations and rejects invalid parameters', () => {
    expect(engine.smoothWpm(0, 100, 0.3)).toBe(30)
    expect(() => engine.smoothWpm(50, 100, 2)).toThrow()
    expect(() => engine.calculateWpm(Infinity, 1)).toThrow()
  })
  it('does not sustain a combo when the clock goes backward', () => {
    expect(engine.isComboSustained(100, 200)).toBe(false)
  })
})
