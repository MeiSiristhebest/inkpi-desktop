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
  prerequisiteStrandIds?: string[]
  reminderAfterChapters?: number
  lastProgressNote?: string
  tags: string[]
  updatedAt: number
}

export interface ThreadHealthMetric {
  strandId: string
  title: string
  dormancyDistance: number | null
  isStarved: boolean // Author reminder interval reached.
  convergenceReadiness: 'ready' | 'blocked' | 'unknown'
  pendingPrerequisites: string[]
}
