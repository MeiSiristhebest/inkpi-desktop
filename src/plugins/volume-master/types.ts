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
  r2: number | null
  apexRatio: number | null
  sampleCount: number
}
export interface VolumeStat {
  volumeId: string
  title: string
  order: number
  chapterCount: number
  actualWordCount: number | null
  targetWordCount: number | null
  burnRate: number | null
  status: 'unplanned' | 'within_budget' | 'over_budget' | 'author_completed'
  currentAct: ActStage | null
  advice: string
  arcRegression?: OlsQuadraticResult
}
export interface TotalBookMetrics {
  totalVolumes: number
  totalChapters: number
  totalWordCount: number | null
  projectedTotalWords: number | null
  plannedVolumes: number
}
