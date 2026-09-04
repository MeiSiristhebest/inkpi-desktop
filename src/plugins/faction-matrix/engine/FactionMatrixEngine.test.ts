import { describe, it, expect } from 'vitest'
import { factionMatrixEngine } from './FactionMatrixEngine'
import type { FactionNode, FactionDiplomacyRecord } from '../types'

describe('FactionMatrixEngine', () => {
  const factions: FactionNode[] = [
    { id: 'f1', name: '玄剑宗', type: 'righteous', protagonistReputation: 40 },
    { id: 'f2', name: '紫霞派', type: 'righteous', protagonistReputation: 20 },
    { id: 'f3', name: '血煞门', type: 'demonic', protagonistReputation: -20 },
  ]

  const diplomacies: FactionDiplomacyRecord[] = [
    {
      id: 'd1',
      projectId: 'p1',
      factionAId: 'f1',
      factionAName: '玄剑宗',
      factionBId: 'f2',
      factionBName: '紫霞派',
      stance: 'allied',
      reputationScore: 80,
      updatedAt: 100,
    },
    {
      id: 'd2',
      projectId: 'p1',
      factionAId: 'f1',
      factionAName: '玄剑宗',
      factionBId: 'f3',
      factionBName: '血煞门',
      stance: 'mortal_enemy',
      reputationScore: -90,
      updatedAt: 100,
    },
  ]

  it('maps reputation scores to correct tier labels and badges', () => {
    expect(factionMatrixEngine.getReputationLevel(-80).label).toBe('不死不休')
    expect(factionMatrixEngine.getReputationLevel(50).label).toBe('友好往来')
    expect(factionMatrixEngine.getReputationLevel(85).label).toBe('生死同盟')
  })

  it('simulates event ripple where attacking an enemy pleases its rival', () => {
    // 主角重创了玄剑宗（-40）
    const result = factionMatrixEngine.simulateEventRipple(factions, diplomacies, 'f1', -40)

    expect(result.directFaction).toBe('玄剑宗')
    expect(result.directChange).toBe(-40)

    // 紫霞派与玄剑宗同盟 -> 对主角好感下降 (-20)
    const zixia = result.ripples.find((r) => r.factionName === '紫霞派')
    expect(zixia).toBeDefined()
    expect(zixia?.change).toBeLessThan(0)

    // 血煞门与玄剑宗是宿敌 -> 对主角好感上升 (+20, “敌人的敌人是朋友”)
    const xuesha = result.ripples.find((r) => r.factionName === '血煞门')
    expect(xuesha).toBeDefined()
    expect(xuesha?.change).toBeGreaterThan(0)
  })

  it('detects Heider structural balance paradox in triangle relationships', () => {
    const paradoxDips: FactionDiplomacyRecord[] = [
      ...diplomacies,
      {
        id: 'd3',
        projectId: 'p1',
        factionAId: 'f2',
        factionAName: '紫霞派',
        factionBId: 'f3',
        factionBName: '血煞门',
        stance: 'allied', // 悖论：紫霞派与血煞门同盟，但紫霞派盟友玄剑宗与血煞门不死不休
        reputationScore: 80,
        updatedAt: 100,
      },
    ]

    const paradoxes = factionMatrixEngine.detectStructuralParadoxes(factions, paradoxDips)
    expect(paradoxes.length).toBe(1)
    expect(paradoxes[0].reason).toContain('地缘结构失衡')
  })
})
