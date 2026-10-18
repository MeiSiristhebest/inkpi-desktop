import { describe, it, expect } from 'vitest'
import { EmotionCurveEngine as engine } from './EmotionCurveEngine'
describe('emotion source and author annotations', () => {
  it('does not invent an emotion vector or diagnose absence', () => {
    const report = engine.evaluateChapter({
      chapterId: 'c',
      chapterTitle: '',
      chapterOrder: 1,
      content: '',
    })
    expect(report).not.toHaveProperty('vector')
    expect(report).not.toHaveProperty('resonanceScore')
    expect(report).toMatchObject({ wordCount: 0, inputStatus: 'empty', matches: [] })
  })
  it('locates a short negated phrase without treating it as a reader emotion', () => {
    const text = '😀没有喜悦，只有词表。'
    const report = engine.evaluateChapter({
      chapterId: 'c',
      chapterTitle: '',
      chapterOrder: 1,
      content: text,
    })
    expect(report.matches.length).toBeGreaterThan(0)
    for (const m of report.matches) expect(text.slice(m.start, m.end)).toBe(m.quote)
    expect(report).not.toHaveProperty('dominantEmotion')
  })
  it('keeps unknown annotation gaps in order rather than joining a consecutive run', () => {
    const chapter = (n: number, annotation?: unknown) =>
      engine.evaluateChapter({
        chapterId: 'c' + n,
        chapterTitle: '',
        chapterOrder: n,
        content: '作者正文。',
        annotation: annotation as any,
      })
    const annotation = {
      values: { tension: 80 },
      note: '作者意图',
      quote: '正文',
      start: 2,
      end: 4,
    }
    const sequence = [
      chapter(4, annotation),
      chapter(1, annotation),
      chapter(2),
      chapter(3, annotation),
    ]
    expect(
      engine.analyzeWindowFatigue(sequence, { emotion: 'tension', threshold: 70, consecutive: 3 }),
    ).toEqual([])
    expect(() => chapter(1, { ...annotation, values: { tension: 101 } })).toThrow()
  })
})
