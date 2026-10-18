import { describe, it, expect } from 'vitest'
import { CombatSandboxEngine } from './CombatSandboxEngine'

describe('CombatSandboxEngine', () => {
  it('requires reviewed constraints rather than inferring a breach from rank difference', () => {
    // 练气(1)打金丹(20)，无补偿
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 1,
      enemyRank: 20,
      compensatoryAssets: [],
    })

    expect(alert.isBreached).toBe(false)
    expect(alert.status).toBe('needs-review')
    expect(alert.compensatoryFactorsNeeded).toContain(
      '补充能力的适用条件、限制、代价以及每一步后果。',
    )
  })

  it('does not treat asset names as proof of sufficient compensation', () => {
    // 筑基(10)打金丹(20)，提供法宝克制与大阵
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 10,
      enemyRank: 20,
      compensatoryAssets: ['天阶断剑克制', '护宗诛仙阵主场', '燃烧十年寿元'],
    })

    expect(alert.status).toBe('needs-review')
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
