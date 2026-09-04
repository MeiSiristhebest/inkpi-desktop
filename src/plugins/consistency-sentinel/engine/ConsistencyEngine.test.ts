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

  describe('Poset DAG 与 Warshall 传递闭包算法', () => {
    it('computes transitive closure accurately with Warshall algorithm', () => {
      // 分支体系：练气 -> 筑基 -> 金丹/魔丹 -> 元婴
      const tiers = ['练气', '筑基', '金丹', '魔丹', '元婴']
      const relations = [
        { lowerTier: '练气', higherTier: '筑基' },
        { lowerTier: '筑基', higherTier: '金丹' },
        { lowerTier: '筑基', higherTier: '魔丹' },
        { lowerTier: '金丹', higherTier: '元婴' },
        { lowerTier: '魔丹', higherTier: '元婴' },
      ]

      const closure = engine.buildTransitiveClosure(tiers, relations)

      // 练气通过传递闭包可达元婴
      expect(closure.get('练气')?.has('筑基')).toBe(true)
      expect(closure.get('练气')?.has('金丹')).toBe(true)
      expect(closure.get('练气')?.has('魔丹')).toBe(true)
      expect(closure.get('练气')?.has('元婴')).toBe(true)

      // 金丹与魔丹并列不可达
      expect(closure.get('金丹')?.has('魔丹')).toBe(false)
      expect(closure.get('魔丹')?.has('金丹')).toBe(false)

      const branchSystem: PowerTierSystem = {
        projectId: 'p2',
        systemName: '仙魔双修',
        tiers,
        specialModifiers: [],
        updatedAt: 100,
      }

      // 金丹与魔丹并列，不可比返回 NaN
      expect(Number.isNaN(engine.compareTiers('金丹', '魔丹', branchSystem, relations))).toBe(true)
      // 练气严格低于元婴
      expect(engine.compareTiers('练气', '元婴', branchSystem, relations)).toBeLessThan(0)
      // 元婴严格高于筑基
      expect(engine.compareTiers('元婴', '筑基', branchSystem, relations)).toBeGreaterThan(0)
    })

    it('detects cycles and returns validation failure for circular power hierarchies', () => {
      // 循环闭环：A < B < C < A
      const cyclicTiers = ['黄阶', '玄阶', '地阶']
      const cyclicRelations = [
        { lowerTier: '黄阶', higherTier: '玄阶' },
        { lowerTier: '玄阶', higherTier: '地阶' },
        { lowerTier: '地阶', higherTier: '黄阶' },
      ]

      const validation = engine.validatePosetDAG(cyclicTiers, cyclicRelations)
      expect(validation.isAcyclic).toBe(false)
      expect(validation.cycles.length).toBeGreaterThan(0)

      const cyclicSystem: PowerTierSystem = {
        projectId: 'p3',
        systemName: '矛盾体系',
        tiers: cyclicTiers,
        specialModifiers: [],
        updatedAt: 100,
      }

      const violations = engine.scanPowerHierarchyCycles(cyclicSystem, cyclicRelations)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].type).toBe('power_hierarchy_cycle')
      expect(violations[0].severity).toBe('critical')
      expect(violations[0].snippet).toContain('黄阶')
    })

    it('validates acyclic Poset DAG correctly when no cycles exist', () => {
      const tiers = ['凡人', '修士', '真仙']
      const relations = [
        { lowerTier: '凡人', higherTier: '修士' },
        { lowerTier: '修士', higherTier: '真仙' },
      ]

      const validation = engine.validatePosetDAG(tiers, relations)
      expect(validation.isAcyclic).toBe(true)
      expect(validation.cycles.length).toBe(0)
    })
  })
})
