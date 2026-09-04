import type {
  GeoMapGridRecord,
  TerrainType,
  GeoMapCell,
  GeoMapRepository,
} from '../../ports/geoMapRepository'

export type { GeoMapGridRecord, TerrainType, GeoMapCell, GeoMapRepository }

export interface TravelTimeCalculation {
  distanceCells: number
  distanceKm: number
  dampingFactor: number // 地形阻尼系数加权
  estimatedDays: number
  speedKmPerDay: number
}

export interface TerritoryTopologyReport {
  isContiguous: boolean // 是否单连通（无飞地）
  subComponentCount: number // 连通块数量
  hasOrphanIslands: boolean // 是否存在孤立飞地
  message: string
}
