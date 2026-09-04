import { describe, it, expect } from 'vitest'
import { EmotionCurveEngine } from './EmotionCurveEngine'

describe('EmotionCurveEngine', () => {
  it('handles empty chapter text gracefully', () => {
    const res = EmotionCurveEngine.evaluateChapter({
      chapterId: 'c1',
      chapterTitle: '空章节',
      chapterOrder: 1,
      content: '',
    })

    expect(res.wordCount).toBe(0)
    expect(res.netPolarity).toBe(0)
    expect(res.warnings.length).toBeGreaterThan(0)
  })

  it('detects strong catharsis and high positive polarity', () => {
    const text = `
      陆沉凌空而立，手中长剑横扫！暴爽的一剑破万法，直接秒杀全场大敌！
      神王倒下，群雄震撼跪伏！全场修士狂笑欢呼，名震八荒，登顶天下第一！
    `.repeat(4)

    const res = EmotionCurveEngine.evaluateChapter({
      chapterId: 'c2',
      chapterTitle: '第2章 登顶',
      chapterOrder: 2,
      content: text,
    })

    expect(res.vector.catharsis).toBeGreaterThan(60)
    expect(res.netPolarity).toBeGreaterThan(30)
    expect(res.dominantEmotion).toBe('catharsis')
  })

  it('detects window fatigue when 3 consecutive chapters are frustrated', () => {
    const lowChapter = (order: number) => ({
      chapterId: `c-${order}`,
      chapterTitle: `第${order}章`,
      chapterOrder: order,
      content: '重伤绝望，被辱吐血，背叛囚禁。'.repeat(6),
    })

    const evals = [1, 2, 3].map(lowChapter).map((c) => EmotionCurveEngine.evaluateChapter(c))
    const alerts = EmotionCurveEngine.analyzeWindowFatigue(evals)

    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0]).toContain('连载弃书高危')
  })
})
