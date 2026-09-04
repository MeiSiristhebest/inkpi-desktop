export type CombatPhase = 'probing' | 'escalation' | 'climax_strike' | 'reversal_turn'

export interface CombatActionBeat {
  phase: CombatPhase
  attacker: string
  moveName: string // 招式/神通/法宝
  tacticDescription: string // 拆招博弈细节
  damageOrConsequence: string // 伤势/消耗/罡气破损
}

export interface PowerBreachAlert {
  isBreached: boolean
  tierDifference: number // 境界差阶
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL_COLLAPSE'
  diagnostic: string
  compensatoryFactorsNeeded: string[]
}

export interface CombatDuelRecord {
  id: string
  projectId: string
  chapterId?: string
  chapterTitle?: string
  protagonistName: string
  protagonistTier: string
  protagonistRankValue: number // 境界标量数值，如 练气1-9=1-9, 筑基=10-19, 金丹=20-29
  enemyName: string
  enemyTier: string
  enemyRankValue: number
  stakes: string // 决战赌注/生死危机
  beats: CombatActionBeat[] // 四段博弈
  compensatoryAssets: string[] // 越级补偿要素 (天阶法宝/禁术/阵法)
  breachAudit: PowerBreachAlert
  updatedAt: number
}

export interface CombatSandboxRepository {
  getAll(projectId: string): Promise<CombatDuelRecord[]>
  get(id: string): Promise<CombatDuelRecord | undefined>
  save(record: CombatDuelRecord): Promise<void>
  delete(id: string): Promise<void>
}
