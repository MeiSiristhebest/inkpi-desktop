import type { RhythmCadenceRecord } from '../../ports/rhythmCadenceRepository'

export type { RhythmCadenceRecord }
export type CadencePhase = 'hook_plant' | 'tension_escalation' | 'climax_payoff' | 'breather_reward'

export interface CycleBeatStatus {
  cycleType: 'micro' | 'meso' | 'macro'
  cycleName: string
  totalSteps: number
  currentStep: number
  progressPct: number
  phase: CadencePhase
  phaseDescription: string
  recommendedAction: string
}

export interface StagnationReport {
  isStagnant: boolean
  stagnantChapters: number
  sampleCount: number
  averageCharacters: number | null
  coefficientOfVariation: number | null
  diagnostic: string
  remedyAction: string
}
