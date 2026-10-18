import type {
  FactionStance,
  FactionDiplomacyRecord,
  FactionDiplomacyRepository,
} from '../../ports/factionDiplomacyRepository'
export type { FactionStance, FactionDiplomacyRecord, FactionDiplomacyRepository }
export interface FactionNode {
  id: string
  projectId?: string
  name: string
  type?: string
  powerTier?: string
  protagonistReputation?: number | null
}
export interface BalanceParadox {
  factionA: string
  factionB: string
  factionC: string
  stanceAB: FactionStance
  stanceBC: FactionStance
  stanceAC: FactionStance
  status: 'review_candidate'
  reason: string
}
export interface EventRippleResult {
  directFaction: string
  directChange: number
  ripples: Array<{
    factionId: string
    factionName: string
    change: number | null
    newReputation: number | null
    status: 'unknown' | 'author_hypothesis'
    reason: string
  }>
}
