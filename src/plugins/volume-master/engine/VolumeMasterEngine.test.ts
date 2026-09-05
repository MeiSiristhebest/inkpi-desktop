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
})
