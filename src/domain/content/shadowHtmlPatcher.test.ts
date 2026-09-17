import { describe, it, expect } from 'vitest'
import { applySemanticPatchesToHtml } from './shadowHtmlPatcher'
import { semanticDocumentFromHtml, semanticDocumentFromText } from './semanticDocument'

describe('shadowHtmlPatcher', () => {
  it('applies a patch to plain HTML without touching an editor DOM', () => {
    const html = '<p>阳光透过树梢洒落在地面上。</p>'
    const doc = semanticDocumentFromHtml('doc-1', html, 1)
    const from = doc.text.indexOf('洒落在地面上')
    const to = from + '洒落在地面上'.length
    const patch = { documentId: 'doc-1', from, to, text: '泛起金色微光' }

    const { updatedHtml, inversePatches } = applySemanticPatchesToHtml(html, [patch], doc)
    expect(updatedHtml).toBe('<p>阳光透过树梢泛起金色微光。</p>')
    expect(inversePatches).toHaveLength(1)
    expect(inversePatches[0].text).toBe('洒落在地面上')
    expect(inversePatches[0].from).toBe(from)
    expect(inversePatches[0].to).toBe(from + '泛起金色微光'.length)
  })

  it('preserves HTML tags and formatting marks outside the patch region', () => {
    const html = '<p>甲<strong>乙丙</strong>丁</p>'
    const doc = semanticDocumentFromHtml('doc-2', html, 1)
    const from = doc.text.indexOf('乙丙')
    const to = from + '乙丙'.length
    const patch = { documentId: 'doc-2', from, to, text: 'XYZ' }

    const { updatedHtml } = applySemanticPatchesToHtml(html, [patch], doc)
    expect(updatedHtml).toBe('<p>甲<strong>XYZ</strong>丁</p>')
  })

  it('handles multiple disjoint patches in correct reverse order', () => {
    const html = '<p>一二三四五六</p>'
    const doc = semanticDocumentFromHtml('doc-3', html, 1)
    const patch1 = { documentId: 'doc-3', from: 0, to: 1, text: '壹' }
    const patch2 = { documentId: 'doc-3', from: 3, to: 4, text: '肆' }

    const { updatedHtml } = applySemanticPatchesToHtml(html, [patch1, patch2], doc)
    expect(updatedHtml).toBe('<p>壹二三肆五六</p>')
  })

  it('works on plain text documents as well', () => {
    const text = '普通文本测试段落'
    const doc = semanticDocumentFromText('doc-4', text, 1)
    const patch = { documentId: 'doc-4', from: 2, to: 4, text: '内容' }
    const { updatedHtml } = applySemanticPatchesToHtml(text, [patch], doc)
    expect(updatedHtml).toBe('普通内容测试段落')
  })
})
