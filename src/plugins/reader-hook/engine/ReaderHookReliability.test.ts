import { describe, it, expect } from 'vitest'
import { readerHookEngine } from './ReaderHookEngine'
describe('ending source and uncertainty', () => {
  it('does not grade absent text or invent an unresolved plot', () => {
    const empty = readerHookEngine.analyzeEnding('')
    expect(empty).not.toHaveProperty('tensionScore')
    expect(empty).toMatchObject({
      inputStatus: 'empty',
      hookType: 'unclassified',
      observations: [],
    })
  })
  it('retains exact ending offsets and treats negation as a literal cue', () => {
    const text = '😀'.repeat(230) + '  本章没有倒计时，也不存在危机。  '
    const report = readerHookEngine.analyzeEnding(text)
    expect(report).not.toHaveProperty('rating')
    expect(report.hookType).toBe('unclassified')
    expect(report.observations.length).toBeGreaterThan(0)
    for (const item of report.observations)
      expect(text.slice(item.start, item.end)).toBe(item.quote)
    expect(report.coverage.end).toBe(text.length)
    expect(report.coverage.start).toBeGreaterThan(0)
  })
})
