import { describe, it, expect } from 'vitest'
import { SubPlotBraidEngine } from './SubPlotBraidEngine'
import type { SubPlotStrand } from '../types'

describe('SubPlotBraidEngine', () => {
  const fakeStrands: SubPlotStrand[] = [
    {
      id: 's1',
      projectId: 'p1',
      title: '调查魔教卧底',
      summary: '主角暗中排查执事堂中的奸细',
      status: 'active',
      involvedCharacterIds: [],
      involvedCharacterNames: ['白长老', '楚风'],
      startChapterOrder: 10,
      lastActiveChapterOrder: 12,
      tags: ['卧底', '宗门'],
      updatedAt: 1,
    },
    {
      id: 's2',
      projectId: 'p1',
      title: '上古剑诀残页寻找',
      summary: '收集五行残卷',
      status: 'resolved',
      involvedCharacterIds: [],
      involvedCharacterNames: ['青鸾'],
      startChapterOrder: 5,
      lastActiveChapterOrder: 30,
      tags: ['宝藏'],
      updatedAt: 1,
    },
  ]

  it('detects strand starvation when current chapter advances far ahead', () => {
    const health = SubPlotBraidEngine.assessStrandHealth({
      strands: fakeStrands,
      currentMaxChapterOrder: 35, // 35 - 12 = 23 (>= 15)
    })

    const s1Health = health.find((h) => h.strandId === 's1')
    expect(s1Health?.dormancyDistance).toBe(23)
    expect(s1Health?.isStarved).toBe(true)
    expect(s1Health?.isCriticalAbandoned).toBe(false)
  })

  it('detects active strands mentioned in chapter text', () => {
    const matched = SubPlotBraidEngine.detectActiveStrandsInText({
      text: '楚风端起茶杯，低声说道：“白长老那边似有异动。”',
      strands: fakeStrands,
    })

    expect(matched.length).toBe(1)
    expect(matched[0].id).toBe('s1')
  })
})
