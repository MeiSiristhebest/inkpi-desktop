import { describe, it, expect } from 'vitest'
import { dialogueDistillerEngine as engine } from './DialogueDistillerEngine'
describe('DialogueDistillerEngine', () => {
  it('extracts explicit leading and trailing speaker tags', () => {
    expect(
      engine.extractCharacterQuotes('陆沉冷笑道：“在哪里？”林夕淡淡道：“明天。”', ['陆沉', '林夕']),
    ).toEqual({ 陆沉: ['在哪里？'], 林夕: ['明天。'] })
    expect(engine.extractCharacterQuotes('“明白。”陆沉答道。', ['陆沉'])).toEqual({
      陆沉: ['明白。'],
    })
  })
  it('counts both punctuation types in one sentence', () => {
    const p = engine.computeVoiceprint('甲', ['真的吗？！'])
    expect(p.questionRatio).toBe(1)
    expect(p.exclamationRatio).toBe(1)
    expect(p.toneStyle).toBe('custom')
  })
  it('does not classify a descriptive similarity as a voice defect', () => {
    const vector = {
      asl: 12,
      questionRatio: 0.2,
      exclamationRatio: 0.3,
      archaicRatio: 0.1,
      colloquialRatio: 0.1,
    }
    const report = engine.comparePair('甲', vector, '乙', vector)
    expect(report.similarity).toBeCloseTo(1)
    expect(report.differences.averageSentenceLength).toBe(0)
    expect(report).not.toHaveProperty('isHomogeneous')
  })
  it('returns independent optional preset copies', () => {
    const first = engine.getPresets()
    first[0].sampleSnippet = 'changed'
    expect(engine.getPresets()[0].sampleSnippet).not.toBe('changed')
  })
})
