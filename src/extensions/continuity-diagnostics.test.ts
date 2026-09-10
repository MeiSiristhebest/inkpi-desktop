import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../domain/content'
import { projectContinuityFindingsToEditor } from '../ai/results/continuityDiagnostics'
import {
  ContinuityDiagnostics,
  clearContinuityDiagnostics,
  setContinuityDiagnostics,
} from './continuity-diagnostics'

describe('ContinuityDiagnostics extension', () => {
  it('renders mapped inline diagnostics and a marker widget', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, ContinuityDiagnostics],
      content: '<p>第一段</p><p>第二段</p>',
    })
    const documentModel = semanticDocumentFromText('chapter-1', '第一段\n第二段', 3)
    const marker = projectContinuityFindingsToEditor(documentModel, [
      {
        id: 'finding-1',
        severity: 'warning',
        description: '第二段存在连续性风险',
        blockIds: [documentModel.blocks[1].id],
      },
    ])[0]

    try {
      setContinuityDiagnostics(editor, [marker])

      const gutterMarker = editor.view.dom.querySelector(
        '[data-ink-continuity-gutter-marker="finding-1"]',
      )
      expect(gutterMarker).toBeTruthy()
      expect(gutterMarker).toHaveClass('ink-continuity-gutter-marker')
      expect(gutterMarker).toHaveAttribute(
        'data-ink-continuity-block-id',
        documentModel.blocks[1].id,
      )
      expect(gutterMarker).toHaveAttribute('data-ink-continuity-severity', 'warning')
      expect(gutterMarker).toHaveAttribute('role', 'img')
      expect(
        editor.view.dom.querySelector('[data-ink-continuity-finding="finding-1"]'),
      ).toBeTruthy()
      expect(editor.view.dom.textContent).toContain('第二段')
    } finally {
      editor.destroy()
    }
  })

  it('renders one gutter marker per located block and skips unlocated findings', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, ContinuityDiagnostics],
      content: '<p>第一段</p><p>第二段</p>',
    })
    const documentModel = semanticDocumentFromText('chapter-3', '第一段\n第二段', 2)
    const [first, second] = documentModel.blocks
    const [located, unlocated] = projectContinuityFindingsToEditor(documentModel, [
      {
        id: 'finding-many',
        severity: 'error',
        description: '跨段落风险',
        blockIds: [first.id, second.id],
      },
      {
        id: 'finding-unlocated',
        severity: 'info',
        description: '没有可靠位置',
      },
    ])

    try {
      setContinuityDiagnostics(editor, [located, unlocated])

      const gutterMarkers = editor.view.dom.querySelectorAll(
        '[data-ink-continuity-gutter-marker="finding-many"]',
      )
      expect(gutterMarkers).toHaveLength(2)
      expect([...gutterMarkers].map((node) => node.getAttribute('data-ink-continuity-block-id'))).toEqual([
        first.id,
        second.id,
      ])
      expect(
        editor.view.dom.querySelector('[data-ink-continuity-gutter-marker="finding-unlocated"]'),
      ).toBeNull()
    } finally {
      editor.destroy()
    }
  })

  it('clears stale diagnostics when the document changes or the caller clears them', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, ContinuityDiagnostics],
      content: '<p>正文</p>',
    })
    const documentModel = semanticDocumentFromText('chapter-2', '正文', 1)
    const marker = projectContinuityFindingsToEditor(documentModel, [
      {
        id: 'finding-2',
        severity: 'error',
        description: '风险',
        blockIds: [documentModel.blocks[0].id],
      },
    ])[0]

    try {
      setContinuityDiagnostics(editor, [marker])
      expect(editor.view.dom.querySelector('[data-ink-continuity-marker="finding-2"]')).toBeTruthy()

      editor.commands.insertContent('新')
      expect(editor.view.dom.querySelector('[data-ink-continuity-marker="finding-2"]')).toBeNull()

      setContinuityDiagnostics(editor, [marker])
      clearContinuityDiagnostics(editor)
      expect(editor.view.dom.querySelector('[data-ink-continuity-marker="finding-2"]')).toBeNull()
    } finally {
      editor.destroy()
    }
  })
})
