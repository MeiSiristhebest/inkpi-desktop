import { describe, expect, it } from 'vitest'
import {
  semanticDocumentFromHtml,
  semanticDocumentFromProseMirror,
  semanticTextFromContent,
} from './index'

describe('Phase 1 source-map boundary evidence', () => {
  it('round-trips nested ProseMirror blocks across selections, patches, and empty blocks', () => {
    const document = semanticDocumentFromProseMirror('nested-pm', {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '甲乙' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '丙' }] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '丁' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '戊' }] }],
            },
          ],
        },
        { type: 'paragraph' },
      ],
    })

    expect(document.text).toBe('甲乙\n丙\n丁\n戊\n')
    expect(document.blocks.map(({ type, text }) => ({ type, text }))).toEqual([
      { type: 'blockquote', text: '甲乙\n丙' },
      { type: 'listItem', text: '丁' },
      { type: 'listItem', text: '戊' },
      { type: 'paragraph', text: '' },
    ])
    expect(document.blocks.map((block) => block.editorPosition)).toEqual([
      { from: 1, to: 8, blockId: document.blocks[0].id },
      { from: 11, to: 14, blockId: document.blocks[1].id },
      { from: 16, to: 19, blockId: document.blocks[2].id },
      { from: 22, to: 22, blockId: document.blocks[3].id },
    ])

    for (const block of document.blocks) {
      const editorRange = document.sourceMap.semanticRangeToEditor(block.from, block.to)
      expect(editorRange).toMatchObject({
        from: block.editorPosition?.from,
        to: block.editorPosition?.to,
      })
      expect(document.sourceMap.editorRangeToSemantic(editorRange)).toEqual({
        from: block.from,
        to: block.to,
      })
    }

    const selection = {
      from: document.blocks[0].from + 1,
      to: document.blocks[2].to,
    }
    const editorSelection = document.sourceMap.semanticRangeToEditor(selection.from, selection.to)
    expect(document.sourceMap.editorRangeToSemantic(editorSelection)).toEqual(selection)

    const patch = {
      from: document.blocks[1].from,
      to: document.blocks[1].from + 1,
    }
    const editorPatch = document.sourceMap.semanticRangeToEditor(patch.from, patch.to)
    expect(document.sourceMap.editorRangeToSemantic(editorPatch)).toEqual(patch)

    const emptyBlock = document.blocks[3]
    expect(
      document.sourceMap.editorRangeToSemantic({
        from: emptyBlock.editorPosition!.from,
        to: emptyBlock.editorPosition!.from,
      }),
    ).toEqual({ from: emptyBlock.from, to: emptyBlock.from })
  })

  it('round-trips inline, nested-block, and empty-block HTML boundaries', () => {
    const html =
      '<blockquote><p>甲<strong>乙</strong><em>丙</em></p><p><span>丁</span><br>戊</p></blockquote>' +
      '<ul><li><p>己</p></li><li>庚<code>辛</code></li></ul><p></p><h2>壬</h2>'
    const document = semanticDocumentFromHtml('nested-html', html)

    expect(semanticTextFromContent('nested-html', html)).toBe('甲乙丙\n丁\n戊\n己\n庚辛\n\n壬')
    expect(document.blocks.map(({ type, text }) => ({ type, text }))).toEqual([
      { type: 'blockquote', text: '甲乙丙\n丁\n戊' },
      { type: 'listItem', text: '己' },
      { type: 'listItem', text: '庚辛' },
      { type: 'p', text: '' },
      { type: 'h2', text: '壬' },
    ])

    const semanticSecondOffset = document.text.indexOf('乙')
    const editorSecondOffset = html.indexOf('乙')
    const editorSecondRange = { from: editorSecondOffset, to: editorSecondOffset + 1 }
    expect(
      document.sourceMap.semanticRangeToEditor(semanticSecondOffset, semanticSecondOffset + 1),
    ).toMatchObject(editorSecondRange)
    expect(document.sourceMap.editorRangeToSemantic(editorSecondRange)).toEqual({
      from: semanticSecondOffset,
      to: semanticSecondOffset + 1,
    })

    const inlineRange = { from: document.text.indexOf('甲'), to: document.text.indexOf('丙') + 1 }
    const inlineEditorRange = document.sourceMap.semanticRangeToEditor(
      inlineRange.from,
      inlineRange.to,
    )
    expect(inlineEditorRange).toMatchObject({
      from: html.indexOf('甲'),
      to: html.indexOf('丙') + 1,
    })
    expect(document.sourceMap.editorRangeToSemantic(inlineEditorRange)).toEqual(inlineRange)

    const blockquote = document.blocks[0]
    const nestedBlockSelection = document.sourceMap.semanticRangeToEditor(
      blockquote.from,
      blockquote.to,
    )
    expect(nestedBlockSelection).toMatchObject({
      from: html.indexOf('甲'),
      to: html.indexOf('戊') + 1,
    })
    expect(document.sourceMap.editorRangeToSemantic(nestedBlockSelection)).toEqual({
      from: blockquote.from,
      to: blockquote.to,
    })

    const emptyBlock = document.blocks[3]
    const emptyTagStart = html.indexOf('<p></p>')
    expect(
      document.sourceMap.editorRangeToSemantic({ from: emptyTagStart, to: emptyTagStart }),
    ).toEqual({ from: emptyBlock.from, to: emptyBlock.to })
  })
})
