import { describe, it, expect } from 'vitest'
import { GeoMapEngine } from './GeoMapEngine'

describe('GeoMapEngine', () => {
  it('calculates travel time with terrain damping', () => {
    // 0,0 到 10,10，比例尺 10km，平原
    const resLand = GeoMapEngine.calculateTravelTime({
      start: { x: 0, y: 0 },
      target: { x: 10, y: 10 },
      scaleKmPerCell: 10,
      speedKmPerDay: 30, // 步卒
      dominantTerrain: 'land',
    })

    expect(resLand.distanceKm).toBeGreaterThan(100)
    expect(resLand.estimatedDays).toBeGreaterThan(3)

    // 同样距离如果是崇山峻岭（阻尼 2.5）
    const resMountain = GeoMapEngine.calculateTravelTime({
      start: { x: 0, y: 0 },
      target: { x: 10, y: 10 },
      scaleKmPerCell: 10,
      speedKmPerDay: 30,
      dominantTerrain: 'mountain',
    })

    expect(resMountain.estimatedDays).toBeGreaterThan(resLand.estimatedDays * 2)
  })

  it('validates territory contiguity and detects orphan islands', () => {
    // 连通单元格
    const connectedCells = [
      { x: 0, y: 0, terrainType: 'land' as const },
      { x: 1, y: 0, terrainType: 'land' as const },
      { x: 1, y: 1, terrainType: 'land' as const },
    ]
    const res1 = GeoMapEngine.validateContiguity(connectedCells)
    expect(res1.isContiguous).toBe(true)
    expect(res1.hasOrphanIslands).toBe(false)
    expect(res1.subComponentCount).toBe(1)

    // 存在孤立飞地 (0,0 和 10,10)
    const disconnectedCells = [
      { x: 0, y: 0, terrainType: 'land' as const },
      { x: 10, y: 10, terrainType: 'city' as const },
    ]
    const res2 = GeoMapEngine.validateContiguity(disconnectedCells)
    expect(res2.isContiguous).toBe(false)
    expect(res2.hasOrphanIslands).toBe(true)
    expect(res2.subComponentCount).toBe(2)
  })
})
