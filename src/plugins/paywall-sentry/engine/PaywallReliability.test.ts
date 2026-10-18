import { describe, it, expect } from 'vitest'
import { PaywallSentryEngine } from './PaywallSentryEngine'
describe('paywall observations and measured counts', () => {
  it('inspects a short chapter without inventing commercial scores', () => {
    const report = PaywallSentryEngine.analyzeChapter({
      chapterId: 'c',
      chapterTitle: '',
      chapterOrder: 1,
      content: '😀谁？',
    })
    expect(report).not.toHaveProperty('ppiScore')
    expect(report).toMatchObject({ wordCount: 3, ending: { inputStatus: 'provided' } })
  })
  it('calculates only supplied counts, with no estimate at zero exposure', () => {
    expect(PaywallSentryEngine.observedConversion({ reached: 10, paid: 3 })).toEqual({
      reached: 10,
      paid: 3,
      rate: 0.3,
    })
    expect(PaywallSentryEngine.observedConversion({ reached: 0, paid: 0 }).rate).toBeNull()
    expect(() => PaywallSentryEngine.observedConversion({ reached: 2, paid: 3 })).toThrow()
    expect(() => PaywallSentryEngine.observedConversion({ reached: 2.5, paid: 1 })).toThrow()
  })
})
