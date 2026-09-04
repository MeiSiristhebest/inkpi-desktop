import type {
  VolumeArcRecord,
  ActStage,
  VolumeArcRepository,
} from '../../ports/volumeArcRepository'

export type { VolumeArcRecord, ActStage, VolumeArcRepository }

export interface OlsQuadraticResult {
  beta0: number
  beta1: number
  beta2: number
  r2: number
  apexRatio: number
}

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
  arcRegression?: OlsQuadraticResult
}

export interface TotalBookMetrics {
  totalVolumes: number
  totalChapters: number
  totalWordCount: number
  projectedTotalWords: number
  overallPacingRating: 'smooth' | 'needs_tightening' | 'danger'
}
