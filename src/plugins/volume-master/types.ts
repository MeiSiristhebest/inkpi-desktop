import type {
  VolumeArcRecord,
  ActStage,
  VolumeArcRepository,
} from '../../ports/volumeArcRepository'

export type { VolumeArcRecord, ActStage, VolumeArcRepository }

export interface VolumeStat {
  volumeId: string
  title: string
  order: number
  chapterCount: number
  actualWordCount: number
  targetWordCount: number
  burnRate: number // 百分比
  status: 'on_track' | 'lagging_water' | 'rushed_climax' | 'completed'
  currentAct: ActStage
  advice: string
}

export interface TotalBookMetrics {
  totalVolumes: number
  totalChapters: number
  totalWordCount: number
  projectedTotalWords: number
  overallPacingRating: 'smooth' | 'needs_tightening' | 'danger'
}
