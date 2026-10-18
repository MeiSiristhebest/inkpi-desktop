import type {
  GeoMapCell,
  TerrainType,
  TravelTimeCalculation,
  TerritoryTopologyReport,
} from '../types'

export class GeoMapEngine {
  /**
   * Optional example factors. These are not measured terrain or speed data.
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
    terrainFactor?: number
  }): TravelTimeCalculation {
    const { start, target, scaleKmPerCell, speedKmPerDay, dominantTerrain = 'land' } = params

    if (
      ![start.x, start.y, target.x, target.y, scaleKmPerCell, speedKmPerDay].every(
        Number.isFinite,
      ) ||
      scaleKmPerCell <= 0 ||
      speedKmPerDay <= 0
    )
      throw new RangeError('坐标、比例尺和速度需要有效数值；比例尺和速度必须大于零。')
    const dx = Math.abs(target.x - start.x)
    const dy = Math.abs(target.y - start.y)
    // 八方向移动有效步数
    const cellDistance = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
    const distanceKm = cellDistance * scaleKmPerCell

    const damping = params.terrainFactor ?? this.TERRAIN_DAMPING[dominantTerrain]
    if (!Number.isFinite(damping) || damping <= 0) throw new RangeError('通行耗时系数必须大于零。')
    const effectiveKm = distanceKm * damping

    const speed = speedKmPerDay
    const estimatedDays = effectiveKm / speed

    return {
      distanceCells: cellDistance,
      distanceKm,
      dampingFactor: damping,
      estimatedDays,
      speedKmPerDay: speed,
    }
  }

  /** Shortest-time route on the supplied grid; diagonal moves cannot cross blocked corners. */
  static planRoute(params: {
    start: { x: number; y: number }
    target: { x: number; y: number }
    scaleKmPerCell: 1 | 10
    speedKmPerDay: number
    cells: GeoMapCell[]
    terrainFactors: Record<TerrainType, number | null>
  }):
    | ({ status: 'ok'; route: Array<{ x: number; y: number }> } & TravelTimeCalculation)
    | { status: 'no-route'; reason: string } {
    this.calculateTravelTime({ ...params, terrainFactor: 1 })
    const key = (point: { x: number; y: number }) => `${point.x},${point.y}`
    const grid = new Map(params.cells.map((cell) => [key(cell), cell]))
    if (
      grid.size !== params.cells.length ||
      params.cells.some((c) => !Number.isSafeInteger(c.x) || !Number.isSafeInteger(c.y))
    )
      throw new RangeError('网格坐标需要唯一的安全整数。')
    if (
      Object.values(params.terrainFactors).some(
        (factor) => factor !== null && (!Number.isFinite(factor) || factor <= 0),
      )
    )
      throw new RangeError('通行耗时系数必须大于零，或明确标为不可通行。')
    const passable = (x: number, y: number) => {
      const cell = grid.get(`${x},${y}`)
      return Boolean(cell && params.terrainFactors[cell.terrainType] != null)
    }
    if (!passable(params.start.x, params.start.y) || !passable(params.target.x, params.target.y))
      return { status: 'no-route', reason: '起点或终点不在可通行网格中。' }
    const startKey = key(params.start),
      targetKey = key(params.target)
    const costs = new Map([[startKey, 0]]),
      parents = new Map<string, string>()
    const pending = new Set([startKey]),
      visited = new Set<string>()
    while (pending.size) {
      const current = [...pending].reduce((a, b) => (costs.get(a)! <= costs.get(b)! ? a : b))
      pending.delete(current)
      if (current === targetKey) break
      visited.add(current)
      const cell = grid.get(current)!
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1]) {
          if (
            (!dx && !dy) ||
            !passable(cell.x + dx, cell.y + dy) ||
            (dx && dy && (!passable(cell.x + dx, cell.y) || !passable(cell.x, cell.y + dy)))
          )
            continue
          const nextKey = `${cell.x + dx},${cell.y + dy}`
          if (visited.has(nextKey)) continue
          const next = grid.get(nextKey)!
          const factor =
            (params.terrainFactors[cell.terrainType]! + params.terrainFactors[next.terrainType]!) /
            2
          const cost =
            costs.get(current)! +
            (Math.hypot(dx, dy) * params.scaleKmPerCell * factor) / params.speedKmPerDay
          if (cost < (costs.get(nextKey) ?? Infinity)) {
            costs.set(nextKey, cost)
            parents.set(nextKey, current)
            pending.add(nextKey)
          }
        }
    }
    if (!costs.has(targetKey))
      return { status: 'no-route', reason: '已绘网格没有连接起终点的可通行路线。' }
    const route = [{ x: params.target.x, y: params.target.y }]
    let previous = targetKey
    while (previous !== startKey) {
      previous = parents.get(previous)!
      const cell = grid.get(previous)!
      route.unshift({ x: cell.x, y: cell.y })
    }
    const distanceCells = route
      .slice(1)
      .reduce((sum, cell, i) => sum + Math.hypot(cell.x - route[i].x, cell.y - route[i].y), 0)
    const distanceKm = distanceCells * params.scaleKmPerCell
    const estimatedDays = costs.get(targetKey)!
    return {
      status: 'ok',
      route,
      distanceCells,
      distanceKm,
      speedKmPerDay: params.speedKmPerDay,
      estimatedDays,
      dampingFactor: distanceKm ? (estimatedDays * params.speedKmPerDay) / distanceKm : 1,
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
    defaultTerrain: TerrainType = 'land',
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
