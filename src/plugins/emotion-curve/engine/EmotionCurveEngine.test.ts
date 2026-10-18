import { describe, it, expect } from 'vitest'
import { EmotionCurveEngine as engine } from './EmotionCurveEngine'
describe('EmotionCurveEngine', () => {
  const chapter = (order: number) => ({
    chapterId: 'c' + order,
    chapterTitle: '',
    chapterOrder: order,
    content: '作者正文。',
  })
  const annotation = { values: { tension: 80 }, note: '作者标注', quote: '正文', start: 2, end: 4 }
  it('uses explicit zero as an author value, distinct from missing dimensions', () => {
    const report = engine.evaluateChapter({
      ...chapter(1),
      annotation: { ...annotation, values: { joy: 0 } },
    })
    expect(report.annotation?.values.joy).toBe(0)
    expect(report.annotation?.values.tension).toBeUndefined()
  })
  it('reports a consecutive author reminder only with a specified condition', () => {
    const sequence = [3, 1, 2].map((n) => engine.evaluateChapter({ ...chapter(n), annotation }))
    expect(engine.analyzeWindowFatigue(sequence)).toEqual([])
    expect(
      engine.analyzeWindowFatigue(sequence, { emotion: 'tension', threshold: 70, consecutive: 3 }),
    ).toEqual(['第 1 至 3 章连续满足作者的 tension 标注提醒条件；读者反应未知。'])
  })
  it('rejects invalid or stale evidence and nonfinite values', () => {
    expect(() =>
      engine.evaluateChapter({ ...chapter(1), annotation: { ...annotation, quote: '另外的正文' } }),
    ).toThrow()
    expect(() =>
      engine.evaluateChapter({
        ...chapter(1),
        annotation: { ...annotation, values: { joy: NaN } },
      }),
    ).toThrow()
  })
})
