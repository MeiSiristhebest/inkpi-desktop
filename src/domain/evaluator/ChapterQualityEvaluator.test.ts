import { describe, it, expect } from 'vitest'
import { ChapterQualityEvaluator } from './ChapterQualityEvaluator'

describe('ChapterQualityEvaluator', () => {
  it('combines rhythm, hook and paywall metrics into a valid composite score', () => {
    const text = `
    第1章 惊变
    林凡握住长剑，注视着苍穹上盘旋的血色巨兽。
    他深吸了一口气，拔剑冲向深渊。生死存亡，尽在这一击！
    然而就在剑锋触碰天道屏障的刹那，整座大殿轰然崩塌……
    门后那道神秘的黑影缓缓转过身来，赫然是？！
    `

    const res = ChapterQualityEvaluator.evaluateChapter({
      projectId: 'proj-1',
      chapterId: 'ch-1',
      chapterTitle: '惊变',
      chapterOrder: 1,
      content: text,
    })

    expect(res.compositeScore).toBeGreaterThan(0)
    expect(res.compositeScore).toBeLessThanOrEqual(100)
    expect(res.pacingRating).toBeDefined()
    expect(res.summaryAdvice.length).toBeGreaterThan(0)
  })
})
