import { describe, it, expect } from 'vitest'
import { ConsistencyEngine } from './ConsistencyEngine'
import type { PowerTierSystem } from '../types'

describe('ConsistencyEngine — 战力阶梯与设定巡检哨兵引擎', () => {
  const engine = new ConsistencyEngine()
  const system: PowerTierSystem = {
    projectId: 'p1',
    systemName: '修真九阶',
    tiers: ['练气', '筑基', '金丹', '元婴', '化神'],
    specialModifiers: ['偷袭', '禁器', '自爆', '剧毒', '天劫'],
    updatedAt: 100,
  }

  it('compares tiers accurately based on index', () => {
    expect(engine.compareTiers('练气', '筑基', system)).toBeLessThan(0)
    expect(engine.compareTiers('金丹', '筑基', system)).toBeGreaterThan(0)
    expect(engine.compareTiers('元婴', '元婴', system)).toBe(0)
    expect(Number.isNaN(engine.compareTiers('神人', '筑基', system))).toBe(true)
  })

  it('flags unexplained power tier inversions', () => {
    const entities = [
      { name: '楚凌霄', realm: '练气' },
      { name: '赵元老', realm: '元婴' },
    ]
    // 楚凌霄（练气）直接秒杀赵元老（元婴），且无任何特殊词
    const text = '楚凌霄一拳秒杀了赵元老，众人惊呆了。'
    const violations = engine.scanTextForInversions(text, entities, system)

    expect(violations.length).toBe(1)
    expect(violations[0].type).toBe('power_tier_inversion')
    expect(violations[0].entityName).toBe('楚凌霄')
    expect(violations[0].opponentName).toBe('赵元老')
  })

  it('tolerates power tier inversion when valid modifier is present in context', () => {
    const entities = [
      { name: '楚凌霄', realm: '练气' },
      { name: '赵元老', realm: '元婴' },
    ]
    // 上下文含有“偷袭”和“剧毒”底牌
    const text = '楚凌霄趁夜色突施剧毒偷袭，终于重创了赵元老！'
    const violations = engine.scanTextForInversions(text, entities, system)

    expect(violations.length).toBe(0) // 不报错，因为合理解释了越阶
  })

  it('detects deceased characters appearing as active subjects', () => {
    const deceased = [{ id: 'c1', name: '方长老' }]
    const activeText = '方长老冷笑一声走上前，拔出佩剑。'
    const violations = engine.scanTextForDeceased(activeText, deceased)

    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].type).toBe('deceased_character_active')
    expect(violations[0].entityName).toBe('方长老')
  })

  it('ignores deceased characters in memory context', () => {
    const deceased = [{ id: 'c1', name: '方长老' }]
    const memoryText = '少年回忆起方长老生前说过的教诲，心中感慨万千。'
    const violations = engine.scanTextForDeceased(memoryText, deceased)

    expect(violations.length).toBe(0)
  })
})
