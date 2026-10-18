import { describe, it, expect } from 'vitest'
import { dialogueDistillerEngine as engine } from './DialogueDistillerEngine'
describe('dialogue attribution and actual measurements', () => {
  it('binds literal single-character and regexp-like names to exact quotations', () => {
    const text = '😀甲说：“在哪里？”乙听着甲。A[1]问：“真的！” “明白。”甲答道。'
    expect(engine.extractCharacterQuotes(text, ['甲', '乙', 'A[1]'])).toEqual({
      甲: ['在哪里？', '明白。'],
      乙: [],
      'A[1]': ['真的！'],
    })
    for (const quote of engine.extractQuoteEvidence(text, ['甲', '乙', 'A[1]']))
      expect(text.slice(quote.start, quote.end)).toBe(quote.quote)
  })
  it('counts punctuation instead of inferring questions or personality from keywords', () => {
    const stats = engine.computeVoiceprint('甲', ['😀好？', '明白！'])
    expect(stats.averageSentenceLength).toBe(2)
    expect(stats.questionRatio).toBe(0.5)
    expect(stats.exclamationRatio).toBe(0.5)
    expect(stats.toneStyle).toBe('custom')
    expect(engine.computeVoiceprint('乙', ['怎么走。']).questionRatio).toBe(0)
  })
  it('does not invent absent measurements or diagnose identical character voices', () => {
    expect(engine.computeVoiceprint('甲', [])).toMatchObject({
      sampleDialogueCount: 0,
      averageSentenceLength: 0,
      questionRatio: 0,
      exclamationRatio: 0,
    })
    const zero = {
      asl: 0,
      questionRatio: 0,
      exclamationRatio: 0,
      archaicRatio: 0,
      colloquialRatio: 0,
    }
    expect(engine.computeCosineSimilarity(zero, zero)).toBeNull()
    expect(engine.comparePair('甲', zero, '乙', zero).isHomogeneous).toBeUndefined()
  })
})
