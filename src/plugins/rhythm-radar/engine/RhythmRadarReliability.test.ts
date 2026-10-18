import { describe, it, expect } from 'vitest'
import { RhythmRadarEngine } from './RhythmRadarEngine'
describe('source based cut alternatives', () => {
  it('has no optimal verdict or generated punchline for empty text', () => {
    const report = RhythmRadarEngine.analyzeChapter('', 'c', 1)
    expect(report).not.toHaveProperty('tensionScore')
    expect(report).not.toHaveProperty('pacingStatus')
    expect(report.cuts).toEqual([])
  })
  it('cuts only actual text boundaries and preserves the continuation', () => {
    const text = '😀她问：“现在走吗？先等一下。”\r\n门开了。她走出去。'
    const report = RhythmRadarEngine.analyzeChapter(text, 'c', 1)
    expect(report.cuts.length).toBeGreaterThan(0)
    for (const cut of report.cuts) {
      expect(text.slice(cut.start, cut.end)).toBe(cut.quote)
      expect(text.slice(cut.end)).toBe(cut.continuation)
      expect(cut.end <= text.indexOf('“') || cut.end >= text.indexOf('”') + 1).toBe(true)
    }
  })
})
