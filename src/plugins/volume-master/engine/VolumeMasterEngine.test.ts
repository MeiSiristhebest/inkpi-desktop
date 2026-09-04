import { describe, it, expect } from 'vitest'
import { volumeMasterEngine } from './VolumeMasterEngine'

describe('VolumeMasterEngine', () => {
  it('calculates volume stat with default target words and healthy status', () => {
    const vol = { id: 'v1', title: '第一卷 潜龙在渊', order: 0 }
    const chapters = [
      { volumeId: 'v1', wordCount: 15000 },
      { volumeId: 'v1', wordCount: 25000 },
    ]
    const stat = volumeMasterEngine.calculateVolumeStat(vol, chapters)

    expect(stat.actualWordCount).toBe(40000)
    expect(stat.targetWordCount).toBe(200000)
    expect(stat.burnRate).toBe(20)
    expect(stat.status).toBe('on_track')
    expect(stat.currentAct).toBe('act2_rising')
  })

  it('warns about lagging water when words exceed 115% in early act', () => {
    const vol = { id: 'v1', title: '第一卷 潜龙在渊', order: 0 }
    const chapters = [{ volumeId: 'v1', wordCount: 250000 }]
    const arcRecord = {
      id: 'arc1',
      projectId: 'p1',
      volumeId: 'v1',
      volumeTitle: '第一卷',
      volumeOrder: 0,
      targetWordCount: 200000,
      coreConflict: '',
      climaxNode: '',
      rewardOutcome: '',
      crossVolumeCliffhanger: '',
      actStage: 'act2_rising' as const,
      updatedAt: 100,
    }
    const stat = volumeMasterEngine.calculateVolumeStat(vol, chapters, arcRecord)

    expect(stat.burnRate).toBe(125)
    expect(stat.status).toBe('lagging_water')
    expect(stat.advice).toContain('灌水风险')
  })

  it('aggregates book metrics across multiple volumes', () => {
    const volumes = [
      { id: 'v1', title: '卷一', order: 0 },
      { id: 'v2', title: '卷二', order: 1 },
    ]
    const chapters = [
      { volumeId: 'v1', wordCount: 100000 },
      { volumeId: 'v2', wordCount: 50000 },
    ]
    const metrics = volumeMasterEngine.aggregateBookMetrics(volumes, chapters, [])

    expect(metrics.totalVolumes).toBe(2)
    expect(metrics.totalChapters).toBe(2)
    expect(metrics.totalWordCount).toBe(150000)
    expect(metrics.projectedTotalWords).toBe(400000)
  })

  it('provides detailed act stage information', () => {
    const info = volumeMasterEngine.getActStageInfo('act3_climax')
    expect(info.label).toContain('第三幕：卷巅峰决战')
    expect(info.progressRange).toBe('60% ~ 85%')
  })

  describe('OLS 2nd-Degree Polynomial Regression & Pacing Arc Metric', () => {
    it('computes exact parameters for a pure quadratic parabola with R^2 = 1.0', () => {
      // y = -4x^2 + 4x + 0 (vertex at x = 0.5, y = 1.0, points at 0, 0.5, 1.0)
      const points = [
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ]
      const ols = volumeMasterEngine.computeOlsQuadratic(points)

      expect(ols.beta0).toBeCloseTo(0, 4)
      expect(ols.beta1).toBeCloseTo(4, 4)
      expect(ols.beta2).toBeCloseTo(-4, 4)
      expect(ols.r2).toBeCloseTo(1.0, 4)
      expect(ols.apexRatio).toBeCloseTo(0.5, 4)
    })

    it('returns default fallback for less than 3 points', () => {
      const fallback = volumeMasterEngine.computeOlsQuadratic([
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ])
      expect(fallback.r2).toBe(0)
      expect(fallback.apexRatio).toBe(0)
    })

    it('computes narrative arc R^2 and apex position ratio from tension sequences', () => {
      // 经典叙事弧：起步较低 -> 75%位置大高潮 -> 结尾余波收束
      const tensionCurve = [0.2, 0.4, 0.6, 0.9, 0.85, 0.3]
      const result = volumeMasterEngine.fitNarrativeArcR2(tensionCurve)

      expect(result.r2).toBeGreaterThanOrEqual(0.6)
      expect(result.apexPositionRatio).toBeGreaterThan(0.4)
      expect(result.apexPositionRatio).toBeLessThanOrEqual(1.0)
    })

    it('integrates regression metrics into calculateVolumeStat without dead code', () => {
      const vol = { id: 'v1', title: '第一卷 潜龙在渊', order: 0 }
      const chaptersWithTension = [
        { volumeId: 'v1', wordCount: 10000, tension: 0.2 },
        { volumeId: 'v1', wordCount: 15000, tension: 0.5 },
        { volumeId: 'v1', wordCount: 20000, tension: 0.8 },
        { volumeId: 'v1', wordCount: 25000, tension: 0.95 },
        { volumeId: 'v1', wordCount: 10000, tension: 0.4 },
      ]
      const stat = volumeMasterEngine.calculateVolumeStat(vol, chaptersWithTension)

      expect(stat.arcRegression).toBeDefined()
      expect(stat.arcRegression?.r2).toBeGreaterThan(0)
      expect(stat.arcRegression?.apexRatio).toBeGreaterThan(0)
    })
  })
})
