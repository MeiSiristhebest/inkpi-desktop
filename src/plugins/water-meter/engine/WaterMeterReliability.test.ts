import { describe, expect, it } from 'vitest'
import { waterMeterEngine } from './WaterMeterEngine'

describe('literal text statistics', () => {
  it('counts Unicode code points consistently in entropy probabilities', () => {
    expect(waterMeterEngine.computeShannonEntropy('🙂🙂')).toBe(0)
    expect(waterMeterEngine.computeShannonEntropy('🙂🙃')).toBe(1)
    expect(waterMeterEngine.auditText('🙂🙃').totalWordCount).toBe(2)
  })

  it('locates short text and retains exact offsets into the untrimmed source', () => {
    const text = '  他忍不住笑了。\n'
    const report = waterMeterEngine.auditText(text)
    expect(report.bloatItems).toHaveLength(1)
    expect(report.bloatItems[0]).toMatchObject({ text: '忍不住', start: 3, end: 6 })
    for (const item of report.bloatItems) expect(text.slice(item.start, item.end)).toBe(item.text)
  })

  it('counts each covered character once even when lexicon entries overlap or repeat', () => {
    const text = '忍不住'.repeat(20)
    const report = waterMeterEngine.auditText(text)
    expect(report.matchedCharacters).toBe(60)
    expect(report.clicheRatio).toBe(1)
    expect(report.bloatItems).toHaveLength(20)
  })

  it('does not compute literary quality, a mandatory reduction or a success verdict from frequency statistics', () => {
    const report = waterMeterEngine.auditText('她静静地陪着孩子，窗外下着雨，谁也没有说话。')
    expect(report).not.toHaveProperty('waterScore')
    expect(report).not.toHaveProperty('waterLevel')
    expect(report).not.toHaveProperty('dehydrationRate')
    expect(report).not.toHaveProperty('estimatedLeanWordCount')
    expect(report.advice.join(' ')).not.toMatch(/精炼度极佳|迟缓|增加.*交锋|无意义/)
  })
})
