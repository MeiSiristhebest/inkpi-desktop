import { describe, it, expect } from 'vitest'
import { SceneBeatsEngine } from './SceneBeatsEngine'
import type { ChapterBeatPlan } from '../types'

describe('SceneBeatsEngine — 细纲节拍计算、字数区间映射与情绪电容分析', () => {
  const engine = new SceneBeatsEngine()

  it('calculates active beat index and progress ranges correctly based on word count', () => {
    const plan: ChapterBeatPlan = {
      id: 'plan-1',
      projectId: 'proj1',
      chapterId: 'ch1',
      targetWordCount: 3000,
      beats: [
        {
          id: 'b1',
          chapterId: 'ch1',
          order: 0,
          beatType: 'goal',
          title: '初入险地',
          goalOrConflict: '搜寻灵草',
          budgetWordRatio: 0.2, // 600 words (0 - 600)
          emotionalIn: 0,
          emotionalOut: 0.2,
          isCompleted: false,
        },
        {
          id: 'b2',
          chapterId: 'ch1',
          order: 1,
          beatType: 'conflict',
          title: '妖兽突袭',
          goalOrConflict: '生死厮杀',
          budgetWordRatio: 0.5, // 1500 words (600 - 2100)
          emotionalIn: 0.2,
          emotionalOut: -0.7,
          isCompleted: false,
        },
        {
          id: 'b3',
          chapterId: 'ch1',
          order: 2,
          beatType: 'climax',
          title: '绝地反杀',
          goalOrConflict: '突破斩妖',
          budgetWordRatio: 0.3, // 900 words (2100 - 3000)
          emotionalIn: -0.7,
          emotionalOut: 0.8,
          isCompleted: false,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    }

    // 当写到 300 字时，应处于第 1 个节拍（0~600）
    const rep1 = engine.calculatePacingStatus(plan, 300)
    expect(rep1.activeBeatIndex).toBe(0)
    expect(rep1.activeBeat?.id).toBe('b1')
    expect(rep1.progressPct).toBe(10)

    // 当写到 1200 字时，应处于第 2 个节拍（600~2100）
    const rep2 = engine.calculatePacingStatus(plan, 1200)
    expect(rep2.activeBeatIndex).toBe(1)
    expect(rep2.activeBeat?.id).toBe('b2')
    expect(rep2.progressPct).toBe(40)

    // 当写到 2500 字时，应处于第 3 个节拍
    const rep3 = engine.calculatePacingStatus(plan, 2500)
    expect(rep3.activeBeatIndex).toBe(2)
    expect(rep3.activeBeat?.id).toBe('b3')
  })

  it('evaluates dramatic arc voltage delta and detects stagnation', () => {
    // 高潮剧烈起伏剧本
    const climaxBeats = engine.generatePresetPlan('climax_burst', 'ch1')
    const arcClimax = engine.evaluateDramaticArc(climaxBeats)
    expect(arcClimax.isStagnant).toBe(false)
    expect(arcClimax.totalVoltageDelta).toBeGreaterThan(1.5)

    // 死水微澜剧本 (起伏极小)
    const stagnantBeats = [
      {
        id: 'b1',
        chapterId: 'ch1',
        order: 0,
        beatType: 'goal' as const,
        title: '喝茶',
        goalOrConflict: '品茗',
        budgetWordRatio: 0.5,
        emotionalIn: 0.1,
        emotionalOut: 0.15,
        isCompleted: false,
      },
      {
        id: 'b2',
        chapterId: 'ch1',
        order: 1,
        beatType: 'conflict' as const,
        title: '继续喝茶',
        goalOrConflict: '谈天',
        budgetWordRatio: 0.5,
        emotionalIn: 0.15,
        emotionalOut: 0.2,
        isCompleted: false,
      },
    ]
    const arcStagnant = engine.evaluateDramaticArc(stagnantBeats)
    expect(arcStagnant.isStagnant).toBe(true)
    expect(arcStagnant.totalVoltageDelta).toBeLessThan(0.4)
  })

  it('generates preset templates with valid beats structure', () => {
    const burst = engine.generatePresetPlan('climax_burst', 'ch-10')
    expect(burst.length).toBe(4)
    expect(burst[0].beatType).toBe('goal')
    expect(burst[2].beatType).toBe('climax')

    const sumRatio = burst.reduce((acc, b) => acc + b.budgetWordRatio, 0)
    expect(sumRatio).toBeCloseTo(1.0, 2)
  })
})
