import type { ChekhovGunRecord, GunStatus } from '../../ports/chekhovGunRepository'

export type { ChekhovGunRecord, GunStatus }

export interface ChekhovRadarStats {
  totalGuns: number
  firedCount: number
  dormantCount: number
  incubatingCount: number
  rustingCount: number
  closureRate: number | null
  abandonedCount: number
  unpositionedCount: number
}

export interface PlantGunSuggestion {
  gunName: string
  category: 'item' | 'secret' | 'character' | 'promise' | 'technique'
  snippet: string
  reason: string
  startOffset: number
  endOffset: number
}
