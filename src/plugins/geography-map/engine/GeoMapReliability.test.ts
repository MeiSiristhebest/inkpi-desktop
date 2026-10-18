import { describe, expect, it } from 'vitest'
import { GeoMapEngine } from './GeoMapEngine'

describe('distance, speed and actual route constraints', () => {
  const input = {
    start: { x: 0, y: 0 },
    target: { x: 1, y: 1 },
    scaleKmPerCell: 1 as const,
    speedKmPerDay: 0.5,
  }
  it('retains diagonal precision until presentation and accepts sub-one speeds', () => {
    const result = GeoMapEngine.calculateTravelTime(input)
    expect(result.distanceKm).toBeCloseTo(Math.SQRT2, 12)
    expect(result.estimatedDays).toBeCloseTo(Math.SQRT2 / 0.5, 12)
    expect(result.speedKmPerDay).toBe(0.5)
  })
  it('returns zero duration for the same place', () => {
    expect(GeoMapEngine.calculateTravelTime({ ...input, target: input.start }).estimatedDays).toBe(
      0,
    )
  })
  it('rejects invalid numbers rather than silently changing them', () => {
    for (const speed of [0, -1, NaN, Infinity])
      expect(() => GeoMapEngine.calculateTravelTime({ ...input, speedKmPerDay: speed })).toThrow()
  })
  it('uses actual grid cells and refuses an impassable route or diagonal corner cutting', () => {
    const cells = GeoMapEngine.createInitialGrid(2, 2).map((cell) => ({
      ...cell,
      terrainType: cell.x !== cell.y ? ('barrier' as const) : cell.terrainType,
    }))
    expect(
      GeoMapEngine.planRoute({
        ...input,
        cells,
        terrainFactors: { land: 1, city: 1, water: 1, mountain: 1, barrier: null },
      }).status,
    ).toBe('no-route')
  })
  it('finds a traversable detour instead of treating the paint brush as the whole route', () => {
    const cells = GeoMapEngine.createInitialGrid(3, 2).map((cell) => ({
      ...cell,
      terrainType: cell.x === 1 && cell.y === 0 ? ('barrier' as const) : cell.terrainType,
    }))
    const route = GeoMapEngine.planRoute({
      ...input,
      target: { x: 2, y: 0 },
      cells,
      terrainFactors: { land: 1, city: 1, water: 1, mountain: 1, barrier: null },
    })
    expect(route.status).toBe('ok')
    if (route.status === 'ok') {
      expect(route.distanceKm).toBe(4)
      expect(route.estimatedDays).toBe(8)
      expect(route.route).not.toContainEqual({ x: 1, y: 0 })
    }
  })
})
