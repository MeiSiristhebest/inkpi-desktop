import { describe, it, expect } from 'vitest'
import { CombatSandboxEngine } from './CombatSandboxEngine'

describe('CombatSandboxEngine', () => {
  it('detects critical power breach when jumping two major tiers without assets', () => {
    // 练气(1)打金丹(20)，无补偿
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 1,
      enemyRank: 20,
      compensatoryAssets: [],
    })

    expect(alert.isBreached).toBe(true)
    expect(alert.riskLevel).toBe('CRITICAL_COLLAPSE')
    expect(alert.compensatoryFactorsNeeded.length).toBeGreaterThanOrEqual(3)
  })

  it('tolerates tier gap when sufficient compensatory assets are provided', () => {
    // 筑基(10)打金丹(20)，提供法宝克制与大阵
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 10,
      enemyRank: 20,
      compensatoryAssets: ['天阶断剑克制', '护宗诛仙阵主场', '燃烧十年寿元'],
    })

    expect(alert.riskLevel).toBe('SAFE')
    expect(alert.isBreached).toBe(false)
  })

  it('generates a 4-phase combat duel template', () => {
    const tpl = CombatSandboxEngine.generateFourPhaseTemplate('韩立', '极阴祖师')
    expect(tpl.beats.length).toBe(4)
    expect(tpl.beats[0].phase).toBe('probing')
    expect(tpl.beats[1].phase).toBe('escalation')
    expect(tpl.beats[2].phase).toBe('climax_strike')
    expect(tpl.beats[3].phase).toBe('reversal_turn')
  })
})
