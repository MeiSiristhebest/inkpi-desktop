import { describe, it, expect } from 'vitest'
import { volumeMasterEngine as engine } from './VolumeMasterEngine'
describe('actual volume measurements', () => {
  it('does not create a tension curve or story stage from word counts', () => {
    const chapters = [0, 1, 2].map((order) => ({ volumeId: 'v', order, wordCount: 100 }))
    const stat = engine.calculateVolumeStat({ id: 'v', title: '', order: 0 }, chapters)
    expect(stat.arcRegression).toBeUndefined()
    expect(stat.currentAct).toBeNull()
    expect(stat.targetWordCount).toBeNull()
    expect(stat.actualWordCount).toBe(300)
  })
  it('abstains for deficient fits and constant-series R squared', () => {
    expect(engine.computeOlsQuadratic([])).toBeNull()
    expect(
      engine.computeOlsQuadratic([
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ]),
    ).toBeNull()
    expect(
      engine.computeOlsQuadratic([
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ])?.r2,
    ).toBeNull()
    expect(() =>
      engine.computeOlsQuadratic([
        { x: 0, y: 1 },
        { x: 1, y: NaN },
        { x: 2, y: 1 },
      ]),
    ).toThrow()
  })
  it('does not clamp an out-of-domain peak into a false story climax', () => {
    expect(engine.fitNarrativeArcR2([0, 3, 5]).apexPositionRatio).toBeNull()
    const known = engine.computeOlsQuadratic([
      { x: 1000000000, y: 1 },
      { x: 1000000001, y: 2 },
      { x: 1000000002, y: 1 },
    ])
    expect(known?.r2).toBeCloseTo(1)
  })
})
