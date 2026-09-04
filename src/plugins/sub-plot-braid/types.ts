export type SubPlotStatus = 'planned' | 'active' | 'climax' | 'resolved' | 'abandoned'

export interface SubPlotStrand {
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
  convergenceNote?: string
  tags: string[]
  updatedAt: number
}

export interface ThreadHealthMetric {
  strandId: string
  title: string
  dormancyDistance: number // 距今未推进章节数
  isStarved: boolean // 是否饥饿掉线 (>= 15 章)
  isCriticalAbandoned: boolean // 是否已严重断线 (>= 30 章)
  convergenceReadiness: 'ready' | 'progressing' | 'cold'
}
