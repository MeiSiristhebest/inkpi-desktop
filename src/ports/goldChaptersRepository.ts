export type GoldOpeningDimension = 'motivation' | 'distinctive_asset' | 'conflict' | 'ending_hook'

export interface GoldOpeningRange {
  start: number
  end: number
  text: string
}
export interface GoldOpeningObservation {
  dimension: GoldOpeningDimension
  start: number
  end: number
  quote: string
}
export interface GoldOpeningSnapshot {
  status: 'empty' | 'no-matches' | 'observed'
  sourceLength: number
  scannedCharacters: number
  complete: boolean
  ranges: GoldOpeningRange[]
  observations: GoldOpeningObservation[]
}

export interface GoldChapterEvalRecord {
  id: string
  projectId: string
  /** Legacy uncalibrated scores remain readable; new snapshots do not generate them. */
  score?: number
  isQualified?: boolean
  motiveScore?: number
  goldFingerScore?: number
  conflictScore?: number
  expectationScore?: number
  observationSnapshot?: GoldOpeningSnapshot
  keyDiagnosis: string[]
  suggestions: string[]
  evaluatedAt: number
}

export interface GoldChaptersRepository {
  getAll(projectId: string): Promise<GoldChapterEvalRecord[]>
  get(id: string): Promise<GoldChapterEvalRecord | undefined>
  save(record: GoldChapterEvalRecord): Promise<void>
  delete(id: string): Promise<void>
}
