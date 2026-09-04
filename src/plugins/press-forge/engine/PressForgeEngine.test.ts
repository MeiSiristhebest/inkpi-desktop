import { describe, it, expect } from 'vitest'
import { PressForgeEngine } from './PressForgeEngine'

describe('PressForgeEngine', () => {
  it('formats paragraphs with full-width indents and cleans dirty punctuation', () => {
    const raw = '这是第一段,带有英文逗号...并且还有--破折号。\n\n\n   这是第二段   '
    const res = PressForgeEngine.formatText(raw, {
      presetId: 'qidian-standard',
      indentSpaces: 2,
      paragraphSpacing: 1,
      dialogueStyle: 'standard-quotes',
      fixPunctuation: true,
      checkSensitiveWords: true,
    })

    expect(res.lineCount).toBe(2)
    expect(res.formattedText).toContain('　　这是第一段，带有英文逗号……并且还有——破折号。')
    expect(res.formattedText).toContain('　　这是第二段')
    expect(res.warnings).toHaveLength(0)
  })

  it('detects sensitive words and produces warnings', () => {
    const raw = '主角在暗中调查违禁药品的线索。'
    const res = PressForgeEngine.formatText(raw, {
      presetId: 'jinjiang-clean',
      indentSpaces: 2,
      paragraphSpacing: 1,
      dialogueStyle: 'standard-quotes',
      fixPunctuation: true,
      checkSensitiveWords: true,
    })

    expect(res.warnings.length).toBeGreaterThan(0)
    expect(res.warnings[0]).toContain('违禁药品')
  })

  it('supports bracket dialogue style for light novels', () => {
    const raw = '“你到底是谁？”他冷冷问道。'
    const res = PressForgeEngine.formatText(raw, {
      presetId: 'print-typeset',
      indentSpaces: 2,
      paragraphSpacing: 0,
      dialogueStyle: 'bracket',
      fixPunctuation: true,
      checkSensitiveWords: false,
    })

    expect(res.formattedText).toContain('「你到底是谁？」他冷冷问道。')
  })
})
