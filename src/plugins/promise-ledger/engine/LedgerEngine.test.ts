import { describe, it, expect } from 'vitest'
import { LedgerEngine } from './LedgerEngine'
import type { PromiseLedgerEntry } from '../types'

const makeEntry = (overrides: Partial<PromiseLedgerEntry> = {}): PromiseLedgerEntry => ({
  id: 'p1',
  projectId: 'proj1',
  clueName: '神秘玉佩的秘密',
  tier: 'main_plot',
  plantChapter: 5,
  plantNote: '主角在密室中偶得一枚残缺玉佩',
  dueChapterLimit: 20, // 5 + 20 = 25章必须兑现
  softDeadline: 15,     // 5 + 15 = 20章开始预警
  status: 'planted',
  memoryDecayLambda: 0.05,
  progressHistory: [],
  relatedEntityIds: [],
  relatedChapterIds: [],
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

describe('LedgerEngine — 伏笔记忆衰减与债务状态分析', () => {
  const engine = new LedgerEngine()

  it('calculates memory heat correctly at plant chapter and over decay', () => {
    const entry = makeEntry()
    // 埋设本章，热度应为 1.0
    expect(engine.computeMemoryHeat(entry, 5)).toBe(1.0)
    expect(engine.computeMemoryHeat(entry, 3)).toBe(1.0)

    // 跨越 10 章：e^(-0.05 * 10) = e^(-0.5) ≈ 0.606
    const heatAt15 = engine.computeMemoryHeat(entry, 15)
    expect(heatAt15).toBeCloseTo(0.606, 2)

    // 跨越 40 章：e^(-0.05 * 40) = e^(-2) ≈ 0.135 (< 0.2 警戒线)
    const heatAt45 = engine.computeMemoryHeat(entry, 45)
    expect(heatAt45).toBeLessThan(0.2)
  })

  it('boosts memory heat when progress points are recorded', () => {
    const entry = makeEntry({
      progressHistory: [
        { chapter: 15, note: '玉佩在拍卖行引起黑衣人关注', memoryBoost: 0.6 },
      ],
    })

    // 在第 15 章发生推进，热度得到恢复
    const heatWithoutBoost = engine.computeMemoryHeat(makeEntry(), 16)
    const heatWithBoost = engine.computeMemoryHeat(entry, 16)
    expect(heatWithBoost).toBeGreaterThan(heatWithoutBoost)
    expect(heatWithBoost).toBeLessThanOrEqual(1.0)
  })

  it('evaluates debt snapshots: normal, warning, overdue and closed states', () => {
    const entry = makeEntry() // plant: 5, soft: 15, due: 20
    const entries = [entry]

    // 第 10 章：经过 5 章，未达到软警告（5 < 15）
    const snapNormal = engine.computeDebtSnapshot(entries, 10)[0]
    expect(snapNormal.isWarning).toBe(false)
    expect(snapNormal.isOverdue).toBe(false)
    expect(snapNormal.urgencyScore).toBe(0)

    // 第 21 章：经过 16 章，达到软警告（16 >= 15 且 < 20）
    const snapWarn = engine.computeDebtSnapshot(entries, 21)[0]
    expect(snapWarn.isWarning).toBe(true)
    expect(snapWarn.isOverdue).toBe(false)
    expect(snapWarn.urgencyScore).toBeGreaterThan(0)

    // 第 26 章：经过 21 章，已超期（21 >= 20）
    const snapOverdue = engine.computeDebtSnapshot(entries, 26)[0]
    expect(snapOverdue.isOverdue).toBe(true)
    expect(snapOverdue.urgencyScore).toBeGreaterThan(100)

    // 已回收或废弃状态不产生警告
    const snapPaid = engine.computeDebtSnapshot([makeEntry({ status: 'paid_off' })], 26)[0]
    expect(snapPaid.isOverdue).toBe(false)
    expect(snapPaid.urgencyScore).toBe(0)
  })

  it('detects payoff keyword candidates in chapter text', () => {
    const entries = [
      makeEntry({ id: 'p1', clueName: '赤血龙纹鼎' }),
      makeEntry({ id: 'p2', clueName: '断界渊之盟' }),
      makeEntry({ id: 'p3', clueName: '玄天古卷', status: 'paid_off' }), // 已回收忽略
    ]

    const text = '只见拍卖师揭开红绸，赫然是那失传已久的赤血龙纹鼎！众人皆惊。'
    const candidates = engine.detectPayoffCandidates(text, entries)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].entryId).toBe('p1')
    expect(candidates[0].confidence).toBe(1.0)
  })

  it('computes narrative health score accurately', () => {
    const healthyEntries = [
      makeEntry({ id: 'p1', plantChapter: 1, softDeadline: 30, dueChapterLimit: 50 }),
    ]
    expect(engine.computeNarrativeHealthScore(healthyEntries, 10)).toBe(100)

    const overdueEntries = [
      makeEntry({ id: 'p1', plantChapter: 1, softDeadline: 5, dueChapterLimit: 10 }), // at ch 25, overdue by 14
      makeEntry({ id: 'p2', tier: 'power_system', plantChapter: 2, softDeadline: 6, dueChapterLimit: 12 }),
    ]
    const score = engine.computeNarrativeHealthScore(overdueEntries, 25)
    expect(score).toBeLessThan(80)
  })
})
