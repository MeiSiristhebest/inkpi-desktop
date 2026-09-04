export type SubPlotStatus = 'planned' | 'active' | 'climax' | 'resolved' | 'abandoned'

export interface SubPlotStrandRecord {
  id: string
  projectId: string
  title: string
  summary: string
  status: SubPlotStatus
  involvedCharacterIds: string[]
  involvedCharacterNames: string[]
  startChapterOrder: number
  lastActiveChapterOrder: number
  targetVolumeId?: string
  targetVolumeTitle?: string
  climaxChapterOrder?: number
  convergenceNote?: string // 与主线交汇合流设计
  tags: string[]
  updatedAt: number
}

export interface SubPlotRepository {
  getAll(projectId: string): Promise<SubPlotStrandRecord[]>
  get(id: string): Promise<SubPlotStrandRecord | undefined>
  save(record: SubPlotStrandRecord): Promise<void>
  delete(id: string): Promise<void>
}
