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
  softDeadline: 15, // 5 + 15 = 20章开始预警
  status: 'planted',
  memoryDecayLambda: 0.05,
  progressHistory: [],
  relatedEntityIds: [],
  relatedChapterIds: [],
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

describe('LedgerEngine — 作者期限与原文提及', () => {
  const engine = new LedgerEngine()
  it('computes elapsed positions and does not infer reader memory', () => {
    expect(engine.computeDebtSnapshot([makeEntry()], 5)[0].elapsedChapters).toBe(0)
    expect(engine.computeDebtSnapshot([makeEntry()], 15)[0].elapsedChapters).toBe(10)
    expect(engine.computeDebtSnapshot([makeEntry()], 3)[0].lastProgressChapter).toBeNull()
    expect(engine.computeDebtSnapshot([makeEntry()], 45)[0]).not.toHaveProperty('memoryHeat')
  })
  it('uses the latest actual progress record, excluding future records', () => {
    const entry = makeEntry({
      progressHistory: [
        { chapter: 15, note: '再次出现', memoryBoost: 0.6 },
        { chapter: 100, note: '未来', memoryBoost: 1 },
      ],
    })
    expect(engine.computeDebtSnapshot([entry], 16)[0].lastProgressChapter).toBe(15)
    expect(engine.computeDebtSnapshot([entry], 10)[0].lastProgressChapter).toBe(5)
  })
  it('evaluates normal, warning, due, overdue and closed states from author deadlines', () => {
    const entry = makeEntry()
    expect(engine.computeDebtSnapshot([entry], 10)[0]).toMatchObject({
      isWarning: false,
      isOverdue: false,
      remainingChapters: 15,
    })
    expect(engine.computeDebtSnapshot([entry], 21)[0]).toMatchObject({
      isWarning: true,
      isOverdue: false,
      remainingChapters: 4,
    })
    expect(engine.computeDebtSnapshot([entry], 25)[0]).toMatchObject({
      isDue: true,
      isOverdue: false,
      remainingChapters: 0,
    })
    expect(engine.computeDebtSnapshot([entry], 26)[0]).toMatchObject({
      isOverdue: true,
      remainingChapters: -1,
    })
    for (const status of ['paid_off', 'abandoned'] as const)
      expect(engine.computeDebtSnapshot([makeEntry({ status })], 100)[0]).toMatchObject({
        isDue: false,
        isOverdue: false,
        isWarning: false,
      })
  })
  it('keeps an unplaced promise unknown', () => {
    const entry = makeEntry({ plantChapter: 0, softDeadline: 0, dueChapterLimit: 0 })
    expect(engine.computeDebtSnapshot([entry], 100)[0]).toMatchObject({
      elapsedChapters: null,
      deadlineChapter: null,
      remainingChapters: null,
      lastProgressChapter: null,
      isOverdue: false,
      isWarning: false,
    })
  })
  it('does not turn missing deadlines or chapters into overdue promises', () => {
    expect(
      engine.computeDebtSnapshot([makeEntry({ softDeadline: 0, dueChapterLimit: 0 })], 100)[0],
    ).toMatchObject({ isOverdue: false, isWarning: false, deadlineChapter: null })
    expect(engine.computeDebtSnapshot([makeEntry()], 0)[0]).toMatchObject({
      elapsedChapters: null,
      isOverdue: false,
    })
  })
  it('locates every keyword mention with exact source spans and excludes closed promises', () => {
    const entries = [
      makeEntry({ id: 'p1', clueName: '赤血龙纹鼎' }),
      makeEntry({ id: 'p2', clueName: '断界渊之盟' }),
      makeEntry({ id: 'p3', clueName: '玄天古卷', status: 'paid_off' }),
    ]
    const text = '赤血龙纹鼎并未出现。有人问：“赤血龙纹鼎在哪里？”玄天古卷在台上。'
    const candidates = engine.detectPayoffCandidates(text, entries)
    expect(candidates).toHaveLength(2)
    for (const candidate of candidates) {
      expect(candidate.entryId).toBe('p1')
      expect(candidate.status).toBe('mention')
      expect(text.slice(candidate.startOffset, candidate.endOffset)).toBe(candidate.snippet)
      expect(candidate).not.toHaveProperty('confidence')
    }
  })
  it('does not produce a health grade for empty records or use tier weights', () => {
    expect(engine.computeDebtSnapshot([], 10)).toEqual([])
    const [main, side] = engine.computeDebtSnapshot(
      [makeEntry(), makeEntry({ tier: 'atmosphere' })],
      30,
    )
    expect(main.remainingChapters).toBe(side.remainingChapters)
    expect(main).not.toHaveProperty('urgencyScore')
  })
})
