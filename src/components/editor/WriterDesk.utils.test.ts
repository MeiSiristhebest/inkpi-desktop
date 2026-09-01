import { describe, it, expect } from 'vitest'
import { countWords, formatChineseParagraphs } from './WriterDesk'

describe('countWords — 汉字去空白实时字数', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('strips spaces, tabs and newlines', () => {
    expect(countWords('字 字\n字\t字 ')).toBe(4)
  })

  it('counts CJK + latin characters while ignoring whitespace', () => {
    // h e l l o 世界 = 7
    expect(countWords('  hello世界  ')).toBe(7)
  })
})

describe('formatChineseParagraphs — 中文段落一键缩进', () => {
  it('adds a full-width indent and a blank line between paragraphs', () => {
    expect(formatChineseParagraphs('第一行\n第二行')).toBe('　　第一行\n\n　　第二行')
  })

  it('trims leading/trailing whitespace on each line', () => {
    expect(formatChineseParagraphs('  第一行  \n  第二行  ')).toBe('　　第一行\n\n　　第二行')
  })

  it('removes empty lines', () => {
    expect(formatChineseParagraphs('第一段\n\n\n第二段')).toBe('　　第一段\n\n　　第二段')
  })

  it('returns an empty string for blank input', () => {
    expect(formatChineseParagraphs('   \n  \n ')).toBe('')
    expect(formatChineseParagraphs('')).toBe('')
  })
})
