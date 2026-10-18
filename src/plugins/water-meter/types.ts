import type {
  WaterAuditSnapshot,
  WaterBloatItem,
  WaterAuditRepository,
} from '../../ports/waterAuditRepository'

export type { WaterAuditSnapshot, WaterBloatItem, WaterAuditRepository }

export type WaterLevel = 'lean' | 'normal' | 'watery' | 'flooded'

export interface WaterAuditReport {
  entropyScore: number // empirical character-frequency entropy, bits per non-whitespace code point
  actionVerbRatio: number
  clicheRatio: number
  totalWordCount: number
  matchedCharacters: number
  bloatItems: WaterBloatItem[]
  advice: string[]
}
