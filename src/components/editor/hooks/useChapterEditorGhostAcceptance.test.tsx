import { useRef, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../../../core/settings'
import { GhostText, ghostTextPluginKey } from '../../../extensions/ghost-text'
import { draftJournal } from '../../../services/draftJournal'
import { useChapterEditorModel } from './useChapterEditorModel'

const editors: Editor[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
)

async function prepareSuggestion(projectId: string, suggestion: string) {
  const editor = new Editor({ extensions: [StarterKit, GhostText] })
  editors.push(editor)
  const onRequestGhost = vi.fn().mockResolvedValue(suggestion)
  const result = renderHook(
    () => useChapterEditorModel({ projectId, editorRef: useRef(editor), onRequestGhost }),
    { wrapper },
  ).result
  await waitFor(() => expect(result.current.activeChapter).not.toBeNull())
  editor.on('update', () => result.current.actions.handleEditorUpdate())
  editor.on('selectionUpdate', () => result.current.actions.handleGhostSelectionUpdate())
  const original = '这是一段足够长的测试正文'
  act(() => {
    editor.commands.setContent(`<p>${original}</p>`, { emitUpdate: false })
    editor.commands.setTextSelection(original.length + 1)
    result.current.actions.handleEditorUpdate()
  })
  await waitFor(() => expect(result.current.ghostText).toBe(suggestion), { timeout: 3000 })
  return { editor, result, original, onRequestGhost }
}

describe('partial Ghost Text acceptance with the real editor', () => {
  it('aborts an in-flight request when the request callback changes', async () => {
    let resolveSuggestion: ((value: string) => void) | undefined
    let requestSignal: AbortSignal | undefined
    const firstHandler = vi.fn(
      (_chapterId: string, _text: string, _sourceRevision: number, signal?: AbortSignal) => {
        requestSignal = signal
        return new Promise<string>((resolve) => {
          resolveSuggestion = resolve
        })
      },
    )
    const replacementHandler = vi.fn().mockResolvedValue('new handler suggestion')
    const editor = new Editor({ extensions: [StarterKit, GhostText] })
    editors.push(editor)
    const projectId = 'ghost-handler-replacement'
    const { result, rerender } = renderHook(
      ({ onRequestGhost }) =>
        useChapterEditorModel({ projectId, editorRef: useRef(editor), onRequestGhost }),
      { initialProps: { onRequestGhost: firstHandler }, wrapper },
    )

    await waitFor(() => expect(result.current.activeChapter).not.toBeNull())
    editor.on('update', () => result.current.actions.handleEditorUpdate())
    editor.on('selectionUpdate', () => result.current.actions.handleGhostSelectionUpdate())
    const original = '这是一段足够长的测试正文'
    act(() => {
      editor.commands.setContent(`<p>${original}</p>`, { emitUpdate: false })
      editor.commands.setTextSelection(original.length + 1)
      result.current.actions.handleEditorUpdate()
    })
    await waitFor(() => expect(firstHandler).toHaveBeenCalledOnce(), { timeout: 3000 })
    expect(requestSignal?.aborted).toBe(false)

    rerender({ onRequestGhost: replacementHandler })

    expect(requestSignal?.aborted).toBe(true)
    expect(result.current.ghostText).toBe('')
    expect(ghostTextPluginKey.getState(editor.state)).toBeNull()

    await act(async () => {
      resolveSuggestion?.('stale suggestion')
      await Promise.resolve()
    })

    expect(result.current.ghostText).toBe('')
    expect(ghostTextPluginKey.getState(editor.state)).toBeNull()
    expect(replacementHandler).not.toHaveBeenCalled()
  })

  it.each([
    ['你好，世界。', '你好', '，世界。'],
    ['👩‍💻正在写作', '👩‍💻', '正在写作'],
  ])(
    'keeps the first word or complete emoji in %s intact',
    async (suggestion, accepted, remaining) => {
      const { editor, result, original } = await prepareSuggestion(
        `ghost-unicode-${accepted}`,
        suggestion,
      )
      act(() => result.current.actions.acceptGhostText('word'))
      expect(editor.getText()).toBe(original + accepted)
      expect(result.current.ghostText).toBe(remaining)
    },
  )

  it('accepts words at successive cursor positions while retaining only the unaccepted decoration', async () => {
    const { editor, result, original, onRequestGhost } = await prepareSuggestion(
      'ghost-word-acceptance',
      'Alpha beta gamma',
    )
    act(() => result.current.actions.acceptGhostText('word'))
    expect(editor.getText()).toBe(original + 'Alpha')
    expect(result.current.ghostText).toBe(' beta gamma')
    expect(ghostTextPluginKey.getState(editor.state)).toEqual({
      text: ' beta gamma',
      pos: original.length + 6,
    })
    act(() => result.current.actions.acceptGhostText('word'))
    expect(editor.getText()).toBe(original + 'Alpha beta')
    expect(result.current.ghostText).toBe(' gamma')
    expect(onRequestGhost).toHaveBeenCalledOnce()
    const chapterId = result.current.activeChapter!.id
    expect(draftJournal.get('ghost-word-acceptance', chapterId)?.editorContent).toBe(
      editor.getHTML(),
    )
    act(() => result.current.actions.cancelGhostText())
    expect(editor.getText()).toBe(original + 'Alpha beta')
    expect(ghostTextPluginKey.getState(editor.state)).toBeNull()
  })

  it('accepts one line and keeps the next line outside the document and draft', async () => {
    const { editor, result, original } = await prepareSuggestion(
      'ghost-line-acceptance',
      '第一行建议。\n第二行仍待审阅。',
    )
    act(() => result.current.actions.acceptGhostText('line'))
    expect(editor.getText()).toBe(original + '第一行建议。\n')
    expect(result.current.ghostText).toBe('第二行仍待审阅。')
    expect(editor.getHTML()).not.toContain('第二行')
    act(() => result.current.actions.acceptGhostText())
    expect(editor.getText()).toBe(original + '第一行建议。\n第二行仍待审阅。')
    expect(result.current.ghostText).toBe('')
  })

  it('undo removes the accepted word and cancels the remaining suggestion', async () => {
    const { editor, result, original } = await prepareSuggestion(
      'ghost-undo-acceptance',
      'Hello world',
    )
    act(() => result.current.actions.acceptGhostText('word'))
    expect(editor.getText()).toBe(original + 'Hello')
    act(() => editor.commands.undo())
    expect(editor.getText()).toBe(original)
    expect(result.current.ghostText).toBe('')
    expect(ghostTextPluginKey.getState(editor.state)).toBeNull()
  })

  it('returns focus to the editor after a toolbar button accepts one line', async () => {
    const { editor, result, original } = await prepareSuggestion(
      'ghost-toolbar-focus',
      '第一行建议。\n第二行仍待审阅。',
    )
    const button = document.createElement('button')
    document.body.append(editor.view.dom, button)
    try {
      button.focus()
      expect(document.activeElement).toBe(button)
      act(() => result.current.actions.acceptGhostText('line'))
      expect(editor.getText()).toBe(original + '第一行建议。\n')
      expect(result.current.ghostText).toBe('第二行仍待审阅。')
      await waitFor(() => expect(document.activeElement).toBe(editor.view.dom))
    } finally {
      button.remove()
      editor.view.dom.remove()
    }
  })
})
