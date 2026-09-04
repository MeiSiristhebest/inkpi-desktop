import type {
  GeoMapCell,
  TerrainType,
  TravelTimeCalculation,
  TerritoryTopologyReport,
} from '../types'

export class GeoMapEngine {
  /**
   * 地形通行阻尼因子
   * 平原 1.0, 城市 0.8(官道加成), 水域 1.5(渡船), 山脉 2.5(崇山峻岭), 绝壁天堑 10.0
   */
  static readonly TERRAIN_DAMPING: Record<TerrainType, number> = {
    city: 0.8,
    land: 1.0,
    water: 1.5,
    mountain: 2.5,
    barrier: 10.0,
  }

  /**
   * 行军速度标尺 (km/天)
   */
  static readonly STANDARD_SPEEDS: Record<string, number> = {
    infantry: 30, // 凡人步卒/车马 (30 km/天)
    cavalry: 70, // 精锐轻骑 (70 km/天)
    foundation_fly: 300, // 筑基御剑 (300 km/天)
    core_teleport: 2000, // 金丹/元婴遁法 (2000 km/天)
  }

  /**
   * 计算从单元格 A 到单元格 B 的行军日程时间
   */
  static calculateTravelTime(params: {
    start: { x: number; y: number }
    target: { x: number; y: number }
    scaleKmPerCell: 1 | 10
    speedKmPerDay: number
    dominantTerrain?: TerrainType
  }): TravelTimeCalculation {
    const { start, target, scaleKmPerCell, speedKmPerDay, dominantTerrain = 'land' } = params

    // 使用切比雪夫距离 (Chebyshev Distance) 结合曼哈顿折线系数
    const dx = Math.abs(target.x - start.x)
    const dy = Math.abs(target.y - start.y)
    // 八方向移动有效步数
    const cellDistance = Math.max(dx, dy) + 0.414 * Math.min(dx, dy)
    const distanceKm = Math.round(cellDistance * scaleKmPerCell)

    const damping = this.TERRAIN_DAMPING[dominantTerrain] || 1.0
    const effectiveKm = distanceKm * damping

    const speed = Math.max(1, speedKmPerDay)
    const daysRaw = effectiveKm / speed
    const estimatedDays = Math.max(0.1, Number(daysRaw.toFixed(1)))

    return {
      distanceCells: Math.round(cellDistance),
      distanceKm,
      dampingFactor: damping,
      estimatedDays,
      speedKmPerDay: speed,
    }
  }

  /**
   * 拓扑连通块与无飞地校验（基于洪水填充 / BFS）
   */
  static validateContiguity(cells: GeoMapCell[]): TerritoryTopologyReport {
    if (cells.length === 0) {
      return {
        isContiguous: true,
        subComponentCount: 0,
        hasOrphanIslands: false,
        message: '空领地无拓扑冲突',
      }
    }

    const cellSet = new Set<string>()
    cells.forEach((c) => cellSet.add(`${c.x},${c.y}`))

    const visited = new Set<string>()
    let components = 0

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]

    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`
      if (!visited.has(key)) {
        components++
        // 启动 BFS
        const queue: [number, number][] = [[cell.x, cell.y]]
        visited.add(key)

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!
          for (const [ox, oy] of directions) {
            const nx = cx + ox
            const ny = cy + oy
            const nKey = `${nx},${ny}`
            if (cellSet.has(nKey) && !visited.has(nKey)) {
              visited.add(nKey)
              queue.push([nx, ny])
            }
          }
        }
      }
    }

    const hasOrphanIslands = components > 1
    return {
      isContiguous: components === 1,
      subComponentCount: components,
      hasOrphanIslands,
      message:
        components === 1
          ? '领地拓扑完全连通，无孤立飞地。'
          : `领地存在 ${components} 块分散互不相连的飞地，易产生地缘战略割裂！`,
    }
  }

  /**
   * 生成默认正方形网格画板
   */
  static createInitialGrid(
    width: number = 8,
    height: number = 8,
    defaultTerrain: TerrainType = 'land'
  ): GeoMapCell[] {
    const cells: GeoMapCell[] = []
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        cells.push({ x, y, terrainType: defaultTerrain })
      }
    }
    return cells
  }
}
