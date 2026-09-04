export type TerrainType = 'land' | 'mountain' | 'water' | 'city' | 'barrier'

export interface GeoMapCell {
  x: number
  y: number
  terrainType: TerrainType
}

export interface GeoMapGridRecord {
  id: string
  projectId: string
  locationId: string // 关联地理实体 ID
  parentLocationId?: string // 父级地名，子区域必须完全绘制在父区域内
  scaleKmPerCell: 1 | 10 // 比例尺档位 (1km / 10km)
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  occupiedCells: GeoMapCell[]
  fillColor?: string // 势力与派系占领配色
  linkedOverlays: {
    activeCharacterIds: string[] // 当前在此处的角色
    foreshadowIds: string[] // 发生在此处的伏笔
    timelineEventIds: string[] // 关联历史事件
  }
  updatedAt: number
}

export interface GeoMapRepository {
  getAll(projectId: string): Promise<GeoMapGridRecord[]>
  get(id: string): Promise<GeoMapGridRecord | undefined>
  getByLocationId(locationId: string): Promise<GeoMapGridRecord | undefined>
  save(record: GeoMapGridRecord): Promise<void>
  delete(id: string): Promise<void>
}
