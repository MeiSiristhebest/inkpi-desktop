import type {
  WaterAuditSnapshot,
  WaterBloatItem,
  WaterAuditRepository,
} from '../../ports/waterAuditRepository'

export type { WaterAuditSnapshot, WaterBloatItem, WaterAuditRepository }

export type WaterLevel = 'lean' | 'normal' | 'watery' | 'flooded'

export interface WaterAuditReport {
  waterScore: number // 0-100
  waterLevel: WaterLevel
  entropyScore: number // 0-8
  actionVerbRatio: number
  clicheRatio: number
  totalWordCount: number
  estimatedLeanWordCount: number
  dehydrationRate: number // 百分比, 如 18%
  bloatItems: WaterBloatItem[]
  advice: string[]
}
