import type { ReaderHookRecord, ReaderHookType } from '../../ports/readerHookRepository'

export type { ReaderHookRecord, ReaderHookType }

export type HookRating = 'flat' | 'moderate' | 'cliffhanger' | 'god_tier'

export interface HookAnalysisResult {
  tensionScore: number
  hookType: ReaderHookType
  rating: HookRating
  feedback: string
  detectedKeywords: string[]
  suggestions: string[]
}

export interface HookTemplate {
  id: string
  type: ReaderHookType
  name: string
  description: string
  example: string
}
