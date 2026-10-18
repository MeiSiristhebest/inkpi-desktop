import type {
  CombatDuelRecord,
  CombatActionBeat,
  PowerBreachAlert,
  CombatPhase,
  CombatSandboxRepository,
  CombatConstraint,
  CombatResourceBudget,
} from '../../ports/combatSandboxRepository'

export type {
  CombatDuelRecord,
  CombatActionBeat,
  PowerBreachAlert,
  CombatPhase,
  CombatSandboxRepository,
  CombatConstraint,
  CombatResourceBudget,
}

export interface PowerTierDefinition {
  name: string
  rankValue: number // 境界标度
}

export interface CombatDuelTemplate {
  title: string
  beats: CombatActionBeat[]
}
