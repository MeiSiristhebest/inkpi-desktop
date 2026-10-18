import { describe, expect, it } from 'vitest'
import { AuthorOpsEngine } from './AuthorOpsEngine'
const log = (chapter: number, retention: number, cohort = '读者A') => ({
  date: '2026-10-14',
  period: '24小时',
  cohort,
  metricDefinition: '同期到达人数 / 入组人数',
  chasingReadCount: 10,
  averageSubscription: 4,
  retentionRate: retention,
  dropOffChapter: chapter,
  dropOffReason: '',
  counterAction: '',
})
describe('observed operations statistics', () => {
  it('does not manufacture story causes from retention rates', () => {
    const result = AuthorOpsEngine.analyzeDropOff([log(1, 80), log(2, 60)])[0]
    expect(result.gradientLoss).toBe(20)
    expect(result.isSevereCliff).toBe(false)
    expect(result.probableReason).not.toMatch(/毒点|圣母|送女|剧情节奏|打脸/)
  })
  it('does not compare distinct cohorts or missing measurement definitions', () => {
    expect(AuthorOpsEngine.analyzeDropOff([log(1, 80), log(2, 60, '读者B')])).toEqual([])
    expect(AuthorOpsEngine.analyzeDropOff([{ ...log(1, 80), period: '' }, log(2, 60)])).toEqual([])
  })
  it('preserves unknown work status without fabricated bio, contacts or finish status', () => {
    const card = AuthorOpsEngine.generateBusinessCard('笔名', '', [
      { title: '策划作品', genre: '', totalWords: 0, status: 'planning' },
    ])
    expect(card).toContain('筹备中')
    expect(card).not.toMatch(/已完结|站内编辑|极致心流/)
  })
})
