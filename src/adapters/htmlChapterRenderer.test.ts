import { describe, it, expect } from 'vitest'
import { renderChapterHtmlDocument } from './htmlChapterRenderer'

describe('renderChapterHtmlDocument — 章节 HTML 文档呈现', () => {
  it('wraps content in a standalone document with the title', () => {
    const out = renderChapterHtmlDocument('第001章', '<p>少年</p>')
    expect(out).toContain('<!doctype html>')
    expect(out).toContain('<title>第001章</title>')
    expect(out).toContain('<p>少年</p>')
  })

  it('escapes dangerous characters in the title', () => {
    const out = renderChapterHtmlDocument('a < b & "c"', '<p>x</p>')
    expect(out).toContain('<title>a &lt; b &amp; &quot;c&quot;</title>')
    expect(out).not.toContain('<title>a < b')
  })
})
