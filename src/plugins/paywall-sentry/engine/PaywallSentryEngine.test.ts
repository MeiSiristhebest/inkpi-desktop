import { describe, it, expect } from 'vitest'
import { PaywallSentryEngine } from './PaywallSentryEngine'
describe('PaywallSentryEngine', () => {
  it('does not skip a short supplied ending', () => {
    const result = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c',
      chapterTitle: '短章',
      chapterOrder: 1,
      content: '谁？',
    })
    expect(result.wordCount).toBe(2)
    expect(result.ending.observations.map((o) => o.quote)).toContain('？')
  })
  it('retains metadata and literal source rather than predicting payment', () => {
    const text = '真相在下一章。'
    const result = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c',
      chapterTitle: '标题',
      chapterOrder: null,
      content: text,
    })
    expect(result).toMatchObject({
      chapterId: 'c',
      chapterOrder: null,
      ending: { endingText: text },
    })
    expect(result).not.toHaveProperty('recommendation')
  })
  it('does not infer reader fatigue from chapter length', () => {
    const result = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c',
      chapterTitle: '',
      chapterOrder: 1,
      content: '说明'.repeat(7000),
    })
    expect(result.wordCount).toBe(14000)
    expect(result).not.toHaveProperty('fatigueRiskScore')
  })
})
