import { describe, it, expect } from 'vitest'
import { dialogueDistillerEngine } from './DialogueDistillerEngine'

describe('DialogueDistillerEngine', () => {
  it('extracts character quotes accurately from text', () => {
    const text =
      '陆沉冷笑道：“凭你也配向我出剑？”随后林夕淡淡道：“无需多言，拔剑吧。”'
    const quotes = dialogueDistillerEngine.extractCharacterQuotes(text, ['陆沉', '林夕'])

    expect(quotes['陆沉']).toContain('凭你也配向我出剑？')
    expect(quotes['林夕']).toContain('无需多言，拔剑吧。')
  })

  it('computes voiceprint vector with ASL, question ratio and tone style', () => {
    const quotes = [
      '凭你也配质问老夫？！',
      '老夫纵横三千载，岂容尔等放肆！',
    ]
    const vp = dialogueDistillerEngine.computeVoiceprint('太上长老', quotes)

    expect(vp.sampleDialogueCount).toBe(2)
    expect(vp.vector.questionRatio).toBeGreaterThan(0.4)
    expect(vp.vector.archaicRatio).toBeGreaterThan(0.4)
    expect(vp.toneStyle).toBe('archaic')
  })

  it('detects homogeneous speech patterns when two characters speak identically', () => {
    const v1 = {
      asl: 12,
      questionRatio: 0.2,
      exclamationRatio: 0.3,
      archaicRatio: 0.1,
      colloquialRatio: 0.1,
    }
    const v2 = {
      asl: 12.2,
      questionRatio: 0.21,
      exclamationRatio: 0.29,
      archaicRatio: 0.09,
      colloquialRatio: 0.11,
    }
    const pair = dialogueDistillerEngine.comparePair('主角', v1, '同门配角', v2)

    expect(pair.similarity).toBeGreaterThan(0.95)
    expect(pair.isHomogeneous).toBe(true)
    expect(pair.advice).toContain('声纹严重同质化')
  })

  it('provides rich distinct dialogue presets', () => {
    const presets = dialogueDistillerEngine.getPresets()
    expect(presets.length).toBe(4)
    const styles = presets.map((p) => p.toneStyle)
    expect(styles).toContain('archaic')
    expect(styles).toContain('aggressive')
    expect(styles).toContain('colloquial')
    expect(styles).toContain('laconic')
  })
})
