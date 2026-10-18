import { describe, expect, it } from 'vitest'
import { ShadowReaderEngine } from './ShadowReaderEngine'

describe('blind reader observations', () => {
  it('never converts a negated term into a confirmed toxic event or emotional reaction', () => {
    const text = '她没有跪下，而是抵抗命令。'
    const result = ShadowReaderEngine.simulate(text, 'c1')
    expect(result.toxicAlertCount).toBe(0)
    expect(result.sentimentSummary).toEqual({ rage: 0, applause: 0, suspicious: 0, excited: 0 })
    expect(result.danmakus.length).toBeGreaterThan(0)
    for (const note of result.danmakus) {
      expect(note.isToxicAlert).toBe(false)
      expect(note.sentiment).toBe('review_question')
      expect(text.slice(note.sourceStart, note.sourceEnd)).toBe(note.sourceQuote)
      expect(note.content).not.toMatch(/无原则圣母|怒弃书|毒死我了/)
    }
  })

  it('honors the selected personas and records original paragraph indices including blank lines', () => {
    const text = '前段。\n\n当年的密信尚未拆开。\n全场寂静。'
    const result = ShadowReaderEngine.simulate(text, 'c1', { customPersonas: ['plot_detective'] })
    expect(result.danmakus).toHaveLength(1)
    expect(result.danmakus[0]).toMatchObject({
      personaType: 'plot_detective',
      paragraphIndex: 2,
      sourceQuote: '当年的密信',
    })
  })

  it('does not manufacture a safe verdict or invented preceding plot when there are no matches', () => {
    expect(ShadowReaderEngine.simulate('', 'c1').danmakus).toEqual([])
    const result = ShadowReaderEngine.simulate('信纸上的字已褪色。', 'c1')
    expect(result.toxicAlertCount).toBe(0)
    expect(result.danmakus).toEqual([])
  })
})
