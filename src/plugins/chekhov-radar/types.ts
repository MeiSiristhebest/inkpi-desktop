import type { ChekhovGunRecord, GunStatus } from '../../ports/chekhovGunRepository'

export type { ChekhovGunRecord, GunStatus }

export interface ChekhovRadarStats {
  totalGuns: number
  firedCount: number
  dormantCount: number
  incubatingCount: number
  rustingCount: number
  closureRate: number // 闭环率 0 - 100%
  healthGrade: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'DANGER'
}

export interface PlantGunSuggestion {
  gunName: string
  category: 'item' | 'secret' | 'character' | 'promise' | 'technique'
  snippet: string
  reason: string
}
