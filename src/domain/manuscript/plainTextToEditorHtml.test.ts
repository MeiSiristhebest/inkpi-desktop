import { describe, expect, it } from 'vitest'
import { plainTextToEditorHtml } from './plainTextToEditorHtml'

describe('plainTextToEditorHtml', () => {
  it('creates paragraphs and preserves line breaks within them', () => {
    expect(plainTextToEditorHtml('第一行\n第二行\n\n第三行')).toBe(
      '<p>第一行<br>第二行</p><p>第三行</p>',
    )
  })

  it('escapes markup so imported text cannot become editor HTML', () => {
    expect(plainTextToEditorHtml('<script>alert("x")</script> & text')).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; text</p>',
    )
  })

  it('returns an empty editor paragraph for blank content', () => {
    expect(plainTextToEditorHtml(' \n ')).toBe('<p></p>')
  })
})
