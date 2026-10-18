import { describe, expect, it } from 'vitest'
import { PressForgeEngine } from './PressForgeEngine'
const options = {
  ...PressForgeEngine.PRESETS['print-typeset'].defaultOptions,
  indentSpaces: 0,
  paragraphSpacing: 0,
  fixPunctuation: true,
}
describe('meaning-preserving typesetting', () => {
  it('retains Unicode joiners, URLs and numeric punctuation', () => {
    const text = '家人👩‍👩‍👧‍👦 http://host:8080/a?b=1,2 12:30 1,000'
    const result = PressForgeEngine.formatText(text, options)
    expect(result.formattedText).toBe(text)
    expect(result.fixedPunctuationCount).toBe(0)
    expect(result.characterCount).toBe(Array.from(text.replace(/\s/gu, '')).length)
  })
  it('counts each actual replacement and supports dialogue dash style', () => {
    expect(PressForgeEngine.formatText('你好,真的吗?', options).fixedPunctuationCount).toBe(2)
    expect(
      PressForgeEngine.formatText('“回家吧。”', { ...options, dialogueStyle: 'dash' })
        .formattedText,
    ).toBe('——回家吧。')
  })
  it('rejects fractional and out-of-range layout values', () => {
    expect(() => PressForgeEngine.formatText('正文', { ...options, indentSpaces: 1.5 })).toThrow()
    expect(() =>
      PressForgeEngine.formatText('正文', { ...options, paragraphSpacing: -1 }),
    ).toThrow()
  })
})
