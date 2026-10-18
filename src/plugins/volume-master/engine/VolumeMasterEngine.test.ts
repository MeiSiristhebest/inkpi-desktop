import { describe, it, expect } from 'vitest'
import { volumeMasterEngine as engine } from './VolumeMasterEngine'
const volume = { id: 'v', title: '', order: 0 }
const arc = {
  id: 'a',
  projectId: 'p',
  volumeId: 'v',
  volumeTitle: '',
  volumeOrder: 0,
  targetWordCount: 200,
  actStage: 'act2_rising' as const,
  coreConflict: '',
  climaxNode: '',
  rewardOutcome: '',
  crossVolumeCliffhanger: '',
  updatedAt: 0,
}
describe('Volume data and descriptive fit', () => {
  it('compares only author budgets without inferring plot completion', () => {
    const stat = engine.calculateVolumeStat(volume, [{ volumeId: 'v', wordCount: 250 }], arc)
    expect(stat).toMatchObject({
      actualWordCount: 250,
      burnRate: 125,
      status: 'over_budget',
      currentAct: 'act2_rising',
    })
    expect(stat.advice).not.toContain('灌水')
  })
  it('keeps incomplete book budgets unknown instead of projecting defaults', () => {
    const metrics = engine.aggregateBookMetrics(
      [volume, { id: 'other', title: '', order: 1 }],
      [{ volumeId: 'v', wordCount: 20 }],
      [arc],
    )
    expect(metrics).toMatchObject({
      totalWordCount: 20,
      plannedVolumes: 1,
      projectedTotalWords: null,
    })
  })
  it('fits a known polynomial using the actual points', () => {
    const fit = engine.computeOlsQuadratic([
      { x: 0, y: 0 },
      { x: 0.5, y: 1 },
      { x: 1, y: 0 },
    ])!
    expect(fit.beta0).toBeCloseTo(0, 6)
    expect(fit.beta1).toBeCloseTo(4, 6)
    expect(fit.beta2).toBeCloseTo(-4, 6)
    expect(fit.r2).toBeCloseTo(1, 6)
    expect(fit.apexRatio).toBeCloseTo(0.5, 6)
  })
  it('integrates actual ordered annotations and never creates absent values', () => {
    const points = [0.2, 0.5, 0.8, 0.95, 0.4].map((tension, order) => ({
      volumeId: 'v',
      wordCount: 10,
      order,
      tension,
    }))
    expect(engine.calculateVolumeStat(volume, points).arcRegression?.sampleCount).toBe(5)
    expect(
      engine.calculateVolumeStat(
        volume,
        points.map((p) => ({ ...p, tension: undefined })),
      ).arcRegression,
    ).toBeUndefined()
  })
  it('does not require a fixed phase percentage', () => {
    expect(engine.getActStageInfo('act3_climax').progressRange).toBe('作者规划，无固定篇幅比例')
  })
})
