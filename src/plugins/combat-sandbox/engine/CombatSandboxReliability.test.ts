import { describe, expect, it, vi } from 'vitest'
import { CombatSandboxEngine } from './CombatSandboxEngine'
import { pluginEventBus } from '../../../core/pluginEventBus'

describe('author-declared combat constraints', () => {
  it('calculates actual resource balances and identifies the first overspending step', () => {
    const budget = { name: '弹药', initial: 3, consumptionByBeat: [1, 1, 2] }
    const report = CombatSandboxEngine.auditResourceBudget(budget)
    expect(report.balances.map((step) => step.remaining)).toEqual([2, 1, -1])
    expect(report.overdrawn).toEqual([{ beatIndex: 2, cost: 2, remaining: -1 }])
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 10,
      enemyRank: 10,
      compensatoryAssets: [],
      resourceBudgets: [budget],
    })
    expect(alert.status).toBe('conflict')
    expect(alert.source).toBe('resource-budget')
    expect(() => CombatSandboxEngine.auditResourceBudget({ ...budget, initial: NaN })).toThrow()
  })
  it('cannot infer a win, collapse or physical probability from ranks and asset names', () => {
    for (const assets of [[], ['神器'], ['没有神器'], ['燃烧寿元', '天阶法宝']]) {
      const alert = CombatSandboxEngine.auditPowerBreach({
        protagonistRank: 10,
        enemyRank: 30,
        compensatoryAssets: assets,
      })
      expect(alert.isBreached).toBe(false)
      expect(alert.status).toBe('needs-review')
      expect(alert.diagnostic).not.toMatch(/\d+%|严密平稳|严重崩塌/)
    }
  })
  it('reports exactly the constraints the author marked violated or unknown', () => {
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 10,
      enemyRank: 10,
      compensatoryAssets: [],
      constraints: [
        {
          id: 'ammo',
          description: '只剩一发子弹却开了两枪',
          status: 'violated',
          rationale: '作者核对装备记录',
        },
        { id: 'distance', description: '够不够到目标', status: 'unknown', rationale: '' },
      ],
    })
    expect(alert.isBreached).toBe(true)
    expect(alert.status).toBe('conflict')
    expect(alert.compensatoryFactorsNeeded).toContain('够不够到目标')
    expect(alert.violatedConstraintIds).toEqual(['ammo'])
  })
  it('retains absent facts as absent in the model input', () => {
    const input = CombatSandboxEngine.buildAnalysisInput({ protagonistName: '甲', enemyName: '乙' })
    expect(input.protagonistTechnique).toBeNull()
    expect(input.battlefieldTerrain).toBeNull()
    expect(input.plotGoal).toBeNull()
    expect(JSON.stringify(input)).not.toContain('绝境反杀')
  })
  it('emits no authoritative breach for an unknown result', () => {
    const emit = vi.spyOn(pluginEventBus, 'emit')
    const alert = CombatSandboxEngine.auditPowerBreach({
      protagonistRank: 1,
      enemyRank: 100,
      compensatoryAssets: [],
    })
    CombatSandboxEngine.publishBreachAlert({
      recordId: 'duel-1',
      projectId: 'p',
      protagonistName: '甲',
      enemyName: '乙',
      alert,
    })
    expect(emit).not.toHaveBeenCalled()
    emit.mockRestore()
  })
  it('offers planning slots without inventing attacks or the winner', () => {
    const template = CombatSandboxEngine.generateFourPhaseTemplate('甲', '乙')
    expect(template.beats.every((beat) => beat.damageOrConsequence.includes('待填'))).toBe(true)
    expect(JSON.stringify(template)).not.toMatch(/倒飞喋血|彻底翻盘|毁灭死局/)
  })
})
