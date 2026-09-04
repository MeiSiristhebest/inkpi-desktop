import type {
  FactionStance,
  FactionDiplomacyRecord,
  FactionDiplomacyRepository,
} from '../../ports/factionDiplomacyRepository'

export type { FactionStance, FactionDiplomacyRecord, FactionDiplomacyRepository }

export interface FactionNode {
  id: string
  name: string
  type: 'righteous' | 'demonic' | 'imperial' | 'clan' | 'hidden'
  powerTier?: string
  protagonistReputation: number // -100 到 +100
}

export interface BalanceParadox {
  factionA: string
  factionB: string
  factionC: string
  stanceAB: FactionStance
  stanceBC: FactionStance
  stanceAC: FactionStance
  reason: string
}

export interface EventRippleResult {
  directFaction: string
  directChange: number
  ripples: Array<{
    factionId: string
    factionName: string
    change: number
    newReputation: number
    reason: string
  }>
}
