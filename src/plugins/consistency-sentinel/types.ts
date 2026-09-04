// consistency-sentinel 领域模型与类型定义
import type { PowerTierSystem } from '../../ports/powerTierRepository'

export type { PowerTierSystem }

export type ConsistencyViolationType =
  | 'power_tier_inversion'      // 越阶杀敌失真
  | 'deceased_character_active' // 死者复生硬伤
  | 'term_inconsistency'        // 设定漂移
  | 'power_hierarchy_cycle'     // 战力偏序逻辑闭环/环路矛盾

export interface ConsistencyViolation {
  id: string
  type: ConsistencyViolationType
  severity: 'critical' | 'warning'
  snippet: string
  explanation: string
  suggestedAction: string
  entityName?: string
  opponentName?: string
}

export interface PresetTierSystem {
  id: string
  name: string
  tiers: string[]
  modifiers: string[]
}

export interface TierRelation {
  lowerTier: string
  higherTier: string
}

export interface PosetValidationResult {
  isAcyclic: boolean
  cycles: string[][]
}
