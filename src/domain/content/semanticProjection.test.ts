import { describe, expect, it } from 'vitest'
import {
  projectContent,
  projectEditorContent,
  semanticDocumentFromHtml,
  semanticDocumentFromProseMirror,
  semanticDocumentFromText,
} from './index'

describe('Canonical Semantic Content Representation', () => {
  it('projects ProseMirror JSON without losing marks, blocks, or empty paragraphs', () => {
    const document = semanticDocumentFromProseMirror('doc-1', {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'heading-1' },
          content: [{ type: 'text', text: '标题' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '粗体', marks: [{ type: 'bold' }] },
            { type: 'text', text: '与普通文本' },
          ],
        },
        { type: 'paragraph' },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '引用，“中文标点”。' }] }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '列表一' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '列表二' }] }],
            },
          ],
        },
      ],
    })

    expect(document.representation).toBe('prosemirror-json')
    expect(document.text).toBe('标题\n粗体与普通文本\n\n引用，“中文标点”。\n列表一\n列表二')
    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'blockquote',
      'listItem',
      'listItem',
    ])
    expect(document.blocks[0].id).toBe('heading-1')
    expect(document.blocks[2].text).toBe('')
  })

  it('maps semantic ranges to ProseMirror positions and back', () => {
    const document = semanticDocumentFromProseMirror('doc-2', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '甲乙' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '丙丁' }] },
      ],
    })

    const first = document.sourceMap.semanticToEditor(0)
    const second = document.sourceMap.semanticToEditor(3)
    expect(first).toMatchObject({ from: 1, to: 1 })
    expect(second).toMatchObject({ from: 5, to: 5 })
    expect(document.sourceMap.editorToSemantic({ from: first.from, to: first.to })).toBe(0)
    expect(document.sourceMap.editorRangeToSemantic({ from: 1, to: 3 })).toEqual({ from: 0, to: 2 })
    expect(document.sourceMap.semanticRangeToEditor(0, 2)).toMatchObject({ from: 1, to: 3 })
  })

  it('projects HTML with inline marks, block quotes, lists, breaks, and empty blocks', () => {
    const document = semanticDocumentFromHtml(
      'doc-3',
      '<h2>标题</h2><p>甲<strong>乙</strong><br>丙</p><p></p><blockquote>引用</blockquote><ul><li>一</li><li>二</li></ul>',
    )

    expect(document.representation).toBe('html')
    expect(document.text).toBe('标题\n甲乙\n丙\n\n引用\n一\n二')
    expect(document.blocks.map((block) => block.type)).toEqual([
      'h2',
      'p',
      'p',
      'blockquote',
      'listItem',
      'listItem',
    ])
  })

  it('keeps plain text line boundaries and selects JSON over HTML', () => {
    const plain = semanticDocumentFromText('doc-4', '第一段\n\n第三段')
    expect(plain.text).toBe('第一段\n\n第三段')
    expect(plain.blocks).toHaveLength(3)
    expect(plain.blocks[1].text).toBe('')

    const projected = projectEditorContent({
      documentId: 'doc-5',
      json: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON' }] }],
      },
      html: '<p>HTML</p>',
    })
    expect(projected.text).toBe('JSON')
    expect(projectContent('doc-6', '<p>HTML</p>').text).toBe('HTML')
    expect(projectContent('doc-7', '纯文本').text).toBe('纯文本')
  })

  it('maps HTML inline text and breaks to their source ranges', () => {
    const html = '<p>甲<strong>乙</strong><br>丙</p>'
    const document = semanticDocumentFromHtml('doc-8', html)
    const inlineFrom = html.indexOf('乙')
    const inlineTo = inlineFrom + '乙'.length

    expect(document.sourceMap.semanticRangeToEditor(1, 2)).toMatchObject({
      from: inlineFrom,
      to: inlineTo,
    })
    expect(document.sourceMap.editorRangeToSemantic({ from: inlineFrom, to: inlineTo })).toEqual({
      from: 1,
      to: 2,
    })
  })

  it('keeps selection and patch ranges stable across empty blocks and editor gaps', () => {
    const document = semanticDocumentFromProseMirror('doc-9', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '甲乙' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '丙丁' }] },
      ],
    })
    const first = document.blocks[0].editorPosition!
    const last = document.blocks[2].editorPosition!
    const selection = document.sourceMap.editorRangeToSemantic({ from: first.from, to: last.to })

    expect(selection).toEqual({ from: document.blocks[0].from, to: document.blocks[2].to })
    expect(document.sourceMap.semanticRangeToEditor(selection.from, selection.to)).toMatchObject({
      from: first.from,
      to: last.to,
    })
    expect(document.sourceMap.editorToSemantic({ from: first.to + 1, to: first.to + 1 })).toBe(
      document.blocks[0].to,
    )
    expect(document.sourceMap.semanticRangeToEditor(4, 1)).toMatchObject({
      from: document.sourceMap.semanticToEditor(1).from,
      to: document.sourceMap.semanticToEditor(4).from,
    })
  })
})
