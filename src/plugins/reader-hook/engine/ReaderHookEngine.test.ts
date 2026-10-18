import { describe, it, expect } from 'vitest'
import { readerHookEngine } from './ReaderHookEngine'
describe('ReaderHookEngine', () => {
  it('reports absent input', () => {
    expect(readerHookEngine.analyzeEnding('')).toMatchObject({
      inputStatus: 'empty',
      observations: [],
    })
  })
  it('locates countdown words without classifying the plot', () => {
    const report = readerHookEngine.analyzeEnding('玉简上的倒计时只剩最后三息！')
    expect(report.observations.map((o) => o.quote)).toContain('倒计时')
    expect(report.hookType).toBe('unclassified')
  })
  it('does not grade a peaceful ending as defective', () => {
    const report = readerHookEngine.analyzeEnding('他们相视一笑，沉沉睡去。')
    expect(report).not.toHaveProperty('rating')
    expect(report).not.toHaveProperty('tensionScore')
  })
  it('provides six optional examples, including non-combat choices', () => {
    expect(new Set(readerHookEngine.getTemplates().map((t) => t.type)).size).toBe(6)
  })
})
