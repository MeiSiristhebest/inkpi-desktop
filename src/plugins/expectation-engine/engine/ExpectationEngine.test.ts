import { describe, it, expect } from 'vitest'
import { ExpectationEngine } from './ExpectationEngine'
import type { ExpectationContract } from '../types'

describe('ExpectationEngine — 爽点与期待感曲线调度器引擎', () => {
  const engine = new ExpectationEngine()

  it('calculates SPR accurately', () => {
    expect(engine.calculateSPR(6, 2)).toBe(3.0)
    expect(engine.calculateSPR(2, 4)).toBe(0.5)
    expect(engine.calculateSPR(5, 0)).toBe(5.0)
    expect(engine.calculateSPR(0, 0)).toBe(1.0)
  })

  it('evaluates single chapter text for suppression and payoff cues', () => {
    const text = '家族执事冷笑嘲讽，骂他是废物。主角在绝境中突然突破，一招秒杀震惊全场！'
    const report = engine.evaluateChapterText(text, 1)

    expect(report.chapterIndex).toBe(1)
    expect(report.suppressionSum).toBeGreaterThan(0)
    expect(report.payoffSum).toBeGreaterThan(0)
    expect(report.dominantTags).toContain('打压蓄势')
    expect(report.dominantTags).toContain('高能翻盘')
  })

  it('identifies suppression-heavy chapter as high risk', () => {
    const heavyText = '屈辱！嘲讽！打压！吐血！命悬一线！绝境中又被围攻，敌人冷笑羞辱他是废物！'
    const report = engine.evaluateChapterText(heavyText, 2)
    expect(report.riskLevel).toBe('suppression_heavy')
  })

  it('diagnoses golden three chapters correctly', () => {
    const ch1 = '少年身陷退婚屈辱，绝境中脑海中的古玉与至尊骨突然觉醒！'
    const ch2 = '恶仆嘲讽挑衅，少年悍然出手当众突破，一拳秒杀震惊全场！'
    const ch3 = '宗门大比迫在眉睫，三年之约与惊天阴谋悄然浮出水面。'

    const diag = engine.diagnoseGoldenThree(ch1, ch2, ch3)
    expect(diag.chapter1Status.passed).toBe(true)
    expect(diag.chapter2Status.passed).toBe(true)
    expect(diag.chapter3Status.passed).toBe(true)
    expect(diag.overallScore).toBe(100)
  })

  it('audits contracts for overdue and fulfillment rate', () => {
    const contracts: ExpectationContract[] = [
      {
        id: 'c1',
        projectId: 'p1',
        title: '三年之约打脸',
        intensity: 5,
        status: 'fulfilled',
        plantedChapter: 1,
        promisedResolveChapter: 50,
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: 'c2',
        projectId: 'p1',
        title: '外门大比夺魁',
        intensity: 4,
        status: 'building',
        plantedChapter: 5,
        promisedResolveChapter: 15,
        createdAt: 100,
        updatedAt: 100,
      },
    ]

    // 当前在第 20 章，c2 逾期
    const audit = engine.auditContracts(contracts, 20)
    expect(audit.total).toBe(2)
    expect(audit.fulfilled).toBe(1)
    expect(audit.activeCount).toBe(1)
    expect(audit.overdueContracts.length).toBe(1)
    expect(audit.fulfillmentRate).toBe(50)
  })
})
