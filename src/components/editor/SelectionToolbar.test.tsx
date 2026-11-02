import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { IndexedDbProposalStore, ProposalLedger } from '../../ai/proposals'
import type {
  PreparedReferenceMaterials,
  ReferenceSourceRecord,
} from '../../domain/references/referenceMaterials'
import { referenceLibraryService } from '../../services/referenceLibraryService'
import { SelectionToolbar } from './SelectionToolbar'

// 用可受控的假编辑器验证：空选区不渲染、有选区才渲染，且全程不抛错（不依赖 tippy/portal）
const makeEditor = (selection: { from: number; to: number }) => {
  const handlers: Record<string, (() => void) | undefined> = {}
  let content = '选中文本'
  const editor: any = {
    isActive: () => false,
    state: {
      selection,
      doc: { textBetween: () => content },
    },
    view: {
      coordsAtPos: () => ({ top: 100, left: 50, right: 150, bottom: 120 }),
    },
    on: (evt: string, cb: () => void) => {
      handlers[evt] = cb
    },
    off: () => {},
    getText: () => content,
    commands: {
      insertContentAt: ({ from, to }: { from: number; to: number }, text: string) => {
        content = `${content.slice(0, from)}${text}${content.slice(to)}`
      },
      setContent: (html: string) => {
        // 简化 mock：从 HTML 中剥离标签，仅保留文本内容（测试只校验纯文本）
        content = html.replace(/<[^>]+>/g, '')
      },
    },
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
  }
  return { editor, handlers, getContent: () => content }
}

const containerRef: any = {
  current: {
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 800, bottom: 600 }),
    scrollTop: 0,
  },
}

afterEach(() => vi.restoreAllMocks())

describe('SelectionToolbar', () => {
  it('空选区时不渲染任何工具按钮（返回 null，避免 DOM 冲突）', () => {
    const { editor } = makeEditor({ from: 0, to: 0 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByRole('button', { name: '加粗' })).toBeNull()
  })

  it('有选区时渲染加粗/斜体/AI 润色，且触发 selectionUpdate 后能正确显示', () => {
    const { editor, handlers } = makeEditor({ from: 0, to: 5 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)

    // 初始仍不渲染
    expect(screen.queryByRole('button', { name: '加粗' })).toBeNull()

    // 模拟编辑器发出选区变化事件
    act(() => {
      handlers['selectionUpdate']?.()
    })

    expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '斜体' })).toBeInTheDocument()
    expect(screen.getByText('AI 润色')).toBeInTheDocument()
  })

  it('编辑器无 on/off（或已销毁）时不附加监听、不崩溃', () => {
    const { editor } = makeEditor({ from: 0, to: 5 })
    delete editor.on
    delete editor.off
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByRole('button', { name: '加粗' })).toBeNull()
  })

  it('creates a proposal and applies Accept then Undo through the editor boundary', async () => {
    await db.put('chapters', {
      id: 'chapter-1',
      projectId: 'test-workspace',
      title: '第1章',
      content: '选中文本',
      wordCount: 4,
      order: 0,
      status: 'draft',
      createdAt: 0,
      updatedAt: 0,
      revision: 4,
    })
    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    const onAiTask = vi.fn(async (): Promise<TaskResult> => ({
      taskId: 'toolbar-rewrite',
      kind: 'creative.rewrite',
      status: 'completed',
      output: { format: 'patch', patch: { from: 1, to: 3, text: '改写' } },
    }))
    const view = render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        onOpenAssistant={vi.fn()}
        activeChapterId="chapter-1"
        activeChapterRevision={4}
        workspaceId="test-workspace"
      />,
    )
    act(() => {
      handlers['selectionUpdate']?.()
    })
    fireEvent.click(screen.getByText('AI 润色'))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
    )

    fireEvent.click(screen.getByText('接受'))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('committed'),
    )
    expect(getContent()).toBe('选改写本')

    view.rerender(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-1"
        activeChapterRevision={5}
        workspaceId="test-workspace"
      />,
    )
    fireEvent.click(screen.getByText('撤销'))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('undone'),
    )
    expect(getContent()).toBe('选中文本')
  })

  it('sends the author instruction and leaves the body unchanged until acceptance', async () => {
    await db.put('chapters', {
      id: 'chapter-instructed',
      projectId: 'test-workspace',
      title: '第1章',
      content: '选中文本',
      wordCount: 4,
      order: 0,
      status: 'draft',
      createdAt: 0,
      updatedAt: 0,
      revision: 1,
    })
    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    const source: ReferenceSourceRecord = {
      id: 'reference-railway',
      title: '城市轨道资料',
      originalFileName: 'railway.md',
      format: 'md',
      text: '轨道线路连接城郊。',
      tags: ['都市'],
      contentFingerprint: 'railway-fingerprint',
      importedAt: 1,
      updatedAt: 1,
    }
    const excerptText = '轨道线路连接城郊'
    const preparedReferences: PreparedReferenceMaterials = {
      excerpts: [
        {
          sourceId: source.id,
          sourceTitle: source.title,
          start: 0,
          end: excerptText.length,
          text: excerptText,
          score: 2,
          truncated: false,
        },
      ],
      disclosure: {
        sourceCount: 1,
        selectedCount: 1,
        includedCount: 1,
        omittedCount: 0,
        includedCharacters: excerptText.length,
        sources: [
          {
            sourceId: source.id,
            title: source.title,
            selected: true,
            matchedPassages: 1,
            includedPassages: 1,
            includedCharacters: excerptText.length,
          },
        ],
      },
    }
    vi.spyOn(referenceLibraryService, 'listProjectSources').mockResolvedValue([
      { source, attached: true },
    ])
    const prepareReferences = vi
      .spyOn(referenceLibraryService, 'prepareForTask')
      .mockResolvedValue(preparedReferences)
    const onAiTask = vi.fn(async (_task: AiTask): Promise<TaskResult> => ({
      taskId: 'toolbar-instructed-rewrite',
      kind: 'creative.rewrite',
      status: 'completed',
      output: { format: 'patch', patch: { from: 1, to: 3, text: '压缩' } },
    }))
    render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-instructed"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )
    act(() => handlers['selectionUpdate']?.())

    fireEvent.click(screen.getByRole('button', { name: '选择本次参考资料' }))
    fireEvent.click(await screen.findByRole('button', { name: /本次 AI 参考资料/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: '选择参考资料 城市轨道资料' }))
    act(() => handlers['blur']?.())
    expect(screen.getByRole('button', { name: 'AI 润色' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '按要求修改' }))
    fireEvent.change(screen.getByRole('textbox', { name: '修改要求' }), {
      target: { value: '压缩句子并降低语气' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成建议' }))

    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
    )
    expect(prepareReferences).toHaveBeenCalledWith(
      'test-workspace',
      [source.id],
      expect.stringContaining('压缩句子并降低语气'),
      3_200,
    )
    const task = onAiTask.mock.calls[0]?.[0]
    const payload = task?.input.payload as Record<string, unknown>
    const context = payload.context as Record<string, unknown>
    expect(payload).toMatchObject({ goal: '压缩句子并降低语气' })
    expect(context.referenceMaterials).toMatchObject({ excerpts: preparedReferences.excerpts })
    expect(task?.contextPolicy?.providerIds).toContain('creative.references')
    await waitFor(() => expect(screen.queryByTestId('selection-reference-picker')).toBeNull())
    expect(getContent()).toBe('选中文本')

    fireEvent.click(screen.getByRole('button', { name: '接受' }))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('committed'),
    )
    expect(getContent()).toBe('选压缩本')
  })

  it('shows a failed rewrite and retries the same selected range', async () => {
    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    const onAiTask = vi
      .fn(async (_task: AiTask): Promise<TaskResult> => ({
        taskId: 'toolbar-retried-rewrite',
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 1, to: 3, text: '重试' } },
      }))
      .mockRejectedValueOnce(new Error('网络连接失败'))
    render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-retry"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )
    act(() => handlers['selectionUpdate']?.())

    fireEvent.click(screen.getByText('AI 润色'))
    expect(await screen.findByTestId('rewrite-task-error')).toHaveTextContent('网络连接失败')
    const originalSelection = onAiTask.mock.calls[0]?.[0].scope.selection
    expect(originalSelection).toMatchObject({ from: 0, to: 4 })
    expect(getContent()).toBe('选中文本')

    editor.state.selection = { from: 1, to: 4 }
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
    )

    expect(onAiTask).toHaveBeenCalledTimes(2)
    expect(onAiTask.mock.calls[1]?.[0].scope.selection).toEqual(originalSelection)
    expect(getContent()).toBe('选中文本')
  })

  it('requires a new rewrite request after the selected source text changes', async () => {
    const { editor, handlers } = makeEditor({ from: 0, to: 5 })
    const onAiTask = vi
      .fn(async (_task: AiTask): Promise<TaskResult> => ({
        taskId: 'toolbar-stale-rewrite',
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 1, to: 3, text: '改写' } },
      }))
      .mockRejectedValueOnce(new Error('模型暂时不可用'))
    render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-stale-rewrite"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )
    act(() => handlers['selectionUpdate']?.())

    fireEvent.click(screen.getByText('AI 润色'))
    expect(await screen.findByTestId('rewrite-task-error')).toHaveTextContent('模型暂时不可用')
    editor.commands.setContent('<p>已经修改的正文</p>')

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(screen.getByTestId('rewrite-task-error')).toHaveTextContent(
      '选区内容或章节已变化，请重新选择后生成。',
    )
    expect(onAiTask).toHaveBeenCalledTimes(1)
  })

  it('ignores a rewrite response that arrives after switching chapters', async () => {
    let resolveTask: ((result: TaskResult) => void) | undefined
    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    const onAiTask = vi.fn(
      () =>
        new Promise<TaskResult>((resolve) => {
          resolveTask = resolve
        }),
    )
    const view = render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-1"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )
    act(() => handlers['selectionUpdate']?.())
    fireEvent.click(screen.getByText('AI 润色'))
    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))

    view.rerender(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={onAiTask}
        activeChapterId="chapter-2"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )
    await act(async () => {
      resolveTask?.({
        taskId: 'late-toolbar-rewrite',
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 1, to: 3, text: '改写' } },
      })
    })

    expect(screen.queryByTestId('rewrite-proposal-preview')).not.toBeInTheDocument()
    expect(getContent()).toBe('选中文本')
  })

  it('rejects a pending rewrite without mutating editor content', async () => {
    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={async () => ({
          taskId: 'toolbar-reject',
          kind: 'creative.rewrite',
          status: 'completed' as const,
          output: { format: 'patch' as const, patch: { from: 1, to: 3, text: '拒绝' } },
        })}
        activeChapterId="chapter-1"
        workspaceId="test-workspace"
      />,
    )
    act(() => {
      handlers['selectionUpdate']?.()
    })
    fireEvent.click(screen.getByText('AI 润色'))
    await waitFor(() => expect(screen.getByText('接受')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '拒绝' }))
    expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('rejected')
    expect(getContent()).toBe('选中文本')
  })

  it('refreshes a visible proposal when another scoped ledger reports a conflict', async () => {
    const proposalId = 'proposal-toolbar-cross-context'
    await db.delete('aiProposals', proposalId)
    let view: ReturnType<typeof render> | undefined
    try {
      const { editor, handlers } = makeEditor({ from: 0, to: 5 })
      view = render(
        <SelectionToolbar
          editor={editor}
          containerRef={containerRef}
          onAiTask={async () => ({
            taskId: 'toolbar-cross-context',
            kind: 'creative.rewrite' as const,
            status: 'completed' as const,
            output: { format: 'patch' as const, patch: { from: 1, to: 3, text: '跨窗' } },
          })}
          activeChapterId="chapter-cross-context"
          activeChapterRevision={1}
          workspaceId="workspace-cross-context"
        />,
      )
      act(() => {
        handlers['selectionUpdate']?.()
      })
      fireEvent.click(screen.getByText('AI 润色'))
      await waitFor(() =>
        expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
      )

      const store = new IndexedDbProposalStore()
      await waitFor(async () => {
        const proposals = await store.list()
        expect(
          proposals.some((proposal) => proposal.id === proposalId && proposal.status === 'pending'),
        ).toBe(true)
      })

      const otherLedger = new ProposalLedger({
        store,
        eventScope: {
          workspaceId: 'workspace-cross-context',
          projectId: 'workspace-cross-context',
        },
      })
      await otherLedger.ready
      otherLedger.accept(proposalId)
      await expect(otherLedger.commit(proposalId, 2, () => undefined)).rejects.toThrow(/stale/)

      await waitFor(() =>
        expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('stale'),
      )
      expect(screen.getByTestId('rewrite-proposal-conflict')).toHaveTextContent('其他窗口')
    } finally {
      view?.unmount()
      await db.delete('aiProposals', proposalId)
    }
  })

  it('blocks proposal commit and surfaces error when durable chapter mutation fails', async () => {
    // 放入实际版本为 99 的章节，期望版本为 4，触发 ProposalChapterUnitOfWork 的 CAS 冲突
    await db.put('chapters', {
      id: 'chapter-1',
      projectId: 'test-workspace',
      title: '第1章',
      content: '选中文本',
      wordCount: 4,
      order: 0,
      status: 'draft',
      createdAt: 0,
      updatedAt: 0,
      revision: 99,
    })

    const { editor, handlers, getContent } = makeEditor({ from: 0, to: 5 })
    render(
      <SelectionToolbar
        editor={editor}
        containerRef={containerRef}
        onAiTask={async () => ({
          taskId: 'toolbar-fail-mutate',
          kind: 'creative.rewrite',
          status: 'completed' as const,
          output: { format: 'patch' as const, patch: { from: 1, to: 3, text: '改写' } },
        })}
        activeChapterId="chapter-1"
        activeChapterRevision={4}
        workspaceId="test-workspace"
      />,
    )
    act(() => {
      handlers['selectionUpdate']?.()
    })
    fireEvent.click(screen.getByText('AI 润色'))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
    )

    fireEvent.click(screen.getByText('接受'))

    // 验证：由于落库版本冲突，UoW 事务阻断，状态转为 stale 且展示冲突错误，编辑器内容保持不变
    await waitFor(() => {
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('stale')
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent(
        'expected revision 4, received 99',
      )
    })
    expect(getContent()).toBe('选中文本')
  })

  it('preserves HTML formatting when proposing and committing rewrites without emitting autosave update', async () => {
    let rawHtml = '<p>Hello <strong>world</strong></p>'
    const setContentSpy = vi.fn((html: string, _options?: { emitUpdate?: boolean }) => {
      rawHtml = html
    })

    await db.put('chapters', {
      id: 'chapter-rich',
      projectId: 'test-workspace',
      volumeId: 'vol-1',
      title: '第1章',
      content: '<p>Hello <strong>world</strong></p>',
      wordCount: 2,
      order: 0,
      status: 'draft',
      createdAt: 0,
      updatedAt: 0,
      revision: 1,
    })

    const handlers: Record<string, (() => void) | undefined> = {}
    const richEditor: any = {
      isActive: () => false,
      state: {
        selection: { from: 1, to: 12 },
        doc: { textBetween: () => 'Hello world' },
      },
      view: {
        coordsAtPos: () => ({ top: 100, left: 50, right: 150, bottom: 120 }),
      },
      on: (evt: string, cb: () => void) => {
        handlers[evt] = cb
      },
      off: () => {},
      getText: () => 'Hello world',
      getHTML: () => rawHtml,
      commands: {
        insertContentAt: (_range: { from: number; to: number }, text: string) => {
          rawHtml = `<p>Hello <strong>${text}</strong></p>`
        },
        setContent: setContentSpy,
      },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
    }

    render(
      <SelectionToolbar
        editor={richEditor}
        containerRef={containerRef}
        onAiTask={async () => ({
          taskId: 'toolbar-rich-text',
          kind: 'creative.rewrite',
          status: 'completed' as const,
          output: { format: 'patch' as const, patch: { from: 6, to: 11, text: 'universe' } },
        })}
        activeChapterId="chapter-rich"
        activeChapterRevision={1}
        workspaceId="test-workspace"
      />,
    )

    act(() => {
      handlers['selectionUpdate']?.()
    })
    fireEvent.click(screen.getByText('AI 润色'))
    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('pending'),
    )

    fireEvent.click(screen.getByText('接受'))

    await waitFor(() =>
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('committed'),
    )

    // 验证：调用了 setContent 并显式传入 emitUpdate: false，杜绝二次触发 autosave
    expect(setContentSpy).toHaveBeenCalledWith('<p>Hello <strong>universe</strong></p>', {
      emitUpdate: false,
    })

    // 验证持久化层已更新
    const persistedChapter = await db.get('chapters', 'chapter-rich')
    expect(persistedChapter?.content).toBe('<p>Hello <strong>universe</strong></p>')
    expect(persistedChapter?.revision).toBe(2)
  })
})
