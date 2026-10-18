import { describe, it, expect } from 'vitest'
import { RhythmRadarEngine } from './RhythmRadarEngine'
describe('RhythmRadarEngine', () => {
  it('retains actual alternatives instead of genre punchlines', () => {
    const text = '午饭后，她去邮局。信已经寄出。'
    const result = RhythmRadarEngine.analyzeChapter(text, 'c', 1)
    expect(result.cuts.map((c) => c.quote)).toEqual(['午饭后，她去邮局。', '信已经寄出。'])
    expect(result).not.toHaveProperty('cliffhanger')
  })
  it('does not cut inside an unclosed quotation', () => {
    expect(RhythmRadarEngine.analyzeChapter('他说：“等待。下一步', 'c', 1).cuts).toEqual([])
  })
  it('bounds displayed alternatives without losing original offsets', () => {
    const text = '今天下雨。\r\n'.repeat(20)
    const result = RhythmRadarEngine.analyzeChapter(text, 'c', 1)
    expect(result.cuts).toHaveLength(8)
    for (const cut of result.cuts) expect(text.slice(cut.start, cut.end)).toBe(cut.quote)
  })
})
