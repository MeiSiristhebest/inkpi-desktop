import type { GoldChapterEvalRecord } from "../../ports/goldChaptersRepository"

export type { GoldChapterEvalRecord }

export interface GoldChaptersEvaluation {
  score: number // 0 ~ 100
  isQualified: boolean
  motiveScore: number
  goldFingerScore: number
  conflictScore: number
  expectationScore: number
  keyDiagnosis: string[]
  suggestions: string[]
}
