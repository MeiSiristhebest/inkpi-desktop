import { describe, it, expect } from 'vitest'
import {
  htmlToPlain,
  countWords,
  formatChineseParagraphs,
  fixPunctuation,
  applyFindReplace,
  exportChapter,
  fontStackFor,
} from './index'

describe('htmlToPlain — HTML 转纯文本', () => {
  it('strips tags and keeps text, preserving paragraph breaks', () => {
    expect(htmlToPlain('<p>少年</p><p>盘膝</p>')).toBe('少年\n盘膝')
  })
  it('returns empty string for blank input', () => {
    expect(htmlToPlain('')).toBe('')
    expect(htmlToPlain('<p></p>')).toBe('')
  })
})

describe('countWords — 汉字去空白实时字数', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })
  it('strips spaces, tabs and newlines', () => {
    expect(countWords('字 字\n字\t字 ')).toBe(4)
  })
  it('counts CJK + latin characters while ignoring whitespace', () => {
    expect(countWords('  hello世界  ')).toBe(7)
  })
})

describe('formatChineseParagraphs — 中文段落一键缩进(HTML)', () => {
  it('adds a full-width indent and wraps each line in <p>', () => {
    expect(formatChineseParagraphs('第一行\n第二行')).toBe('<p>　　第一行</p><p>　　第二行</p>')
  })
  it('trims leading/trailing whitespace on each line', () => {
    expect(formatChineseParagraphs('  第一行  \n  第二行  ')).toBe('<p>　　第一行</p><p>　　第二行</p>')
  })
  it('removes empty lines', () => {
    expect(formatChineseParagraphs('第一段\n\n\n第二段')).toBe('<p>　　第一段</p><p>　　第二段</p>')
  })
  it('also handles HTML input by extracting text first', () => {
    expect(formatChineseParagraphs('<p>甲</p><p>乙</p>')).toBe('<p>　　甲</p><p>　　乙</p>')
  })
  it('returns an empty string for blank input', () => {
    expect(formatChineseParagraphs('   \n  \n ')).toBe('')
    expect(formatChineseParagraphs('')).toBe('')
  })
})

describe('fixPunctuation — 标点符号中文化清洗', () => {
  it('converts ASCII punctuation to full-width and indents', () => {
    expect(fixPunctuation('hi, there?')).toBe('<p>　　hi， there？</p>')
  })
  it('converts ellipsis and dash', () => {
    expect(fixPunctuation('wait... ok--go')).toBe('<p>　　wait…… ok——go</p>')
  })
  it('does not double-indent already-indented lines (and leaves lone periods as-is)', () => {
    expect(fixPunctuation('　　already indented.')).toBe('<p>　　already indented.</p>')
  })
})

describe('applyFindReplace — 全局查找替换', () => {
  it('replaces all occurrences literally', () => {
    expect(applyFindReplace('<p>abc</p>', 'a', 'X')).toBe('<p>Xbc</p>')
  })
  it('returns html unchanged when find is empty', () => {
    expect(applyFindReplace('<p>abc</p>', '', 'X')).toBe('<p>abc</p>')
  })
  it('handles multi-char find', () => {
    expect(applyFindReplace('<p>hello world</p>', 'world', 'inkpi')).toBe('<p>hello inkpi</p>')
  })
})

describe('exportChapter — 导出', () => {
  it('txt exports plain text', () => {
    expect(exportChapter('<p>少年</p><p>盘膝</p>', 'txt')).toBe('少年\n盘膝')
  })
  it('md keeps original html', () => {
    expect(exportChapter('<p>少年</p>', 'md')).toBe('<p>少年</p>')
  })
})

describe('fontStackFor — 字体族映射', () => {
  it('maps serif/sans/mono to css vars', () => {
    expect(fontStackFor('serif')).toBe('var(--ink-font-serif)')
    expect(fontStackFor('sans')).toBe('var(--ink-font-sans)')
    expect(fontStackFor('mono')).toBe('var(--ink-font-mono)')
  })
})
