<<<<<<< ours
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import type { TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { IndexedDbProposalStore, ProposalLedger } from '../../ai/proposals'
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

describe('SelectionToolbar', () => {
  it('空选区时不渲染任何工具按钮（返回 null，避免 DOM 冲突）', () => {
    const { editor } = makeEditor({ from: 0, to: 0 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })

  it('有选区时渲染加粗/斜体/AI 润色，且触发 selectionUpdate 后能正确显示', () => {
    const { editor, handlers } = makeEditor({ from: 0, to: 5 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)

    // 初始仍不渲染
    expect(screen.queryByTitle('加粗')).toBeNull()

    // 模拟编辑器发出选区变化事件
    act(() => {
      handlers['selectionUpdate']?.()
    })

    expect(screen.getByTitle('加粗')).toBeInTheDocument()
    expect(screen.getByTitle('斜体')).toBeInTheDocument()
    expect(screen.getByText('AI 润色')).toBeInTheDocument()
  })

  it('编辑器无 on/off（或已销毁）时不附加监听、不崩溃', () => {
    const { editor } = makeEditor({ from: 0, to: 5 })
    delete editor.on
    delete editor.off
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })

  it('creates a proposal and applies Accept then Undo through the editor boundary', async () => {
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
    const { chapterMutationService } = await import('../../services/defaultChapterMutationService')
    const mutateSpy = vi.spyOn(chapterMutationService, 'mutate').mockResolvedValueOnce({
      success: false,
      conflict: true,
      currentRevision: 99,
      error: 'CAS Conflict: expected revision 4, but current revision is 99',
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

    // 验证：由于落库失败，事务阻断，状态转为 stale 且展示冲突错误，编辑器内容保持不变
    await waitFor(() => {
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('stale')
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('提案版本冲突')
    })
    expect(getContent()).toBe('选中文本')

    mutateSpy.mockRestore()
  })
})

=======
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import type { TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { IndexedDbProposalStore, ProposalLedger } from '../../ai/proposals'
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

describe('SelectionToolbar', () => {
  it('空选区时不渲染任何工具按钮（返回 null，避免 DOM 冲突）', () => {
    const { editor } = makeEditor({ from: 0, to: 0 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })

  it('有选区时渲染加粗/斜体/AI 润色，且触发 selectionUpdate 后能正确显示', () => {
    const { editor, handlers } = makeEditor({ from: 0, to: 5 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)

    // 初始仍不渲染
    expect(screen.queryByTitle('加粗')).toBeNull()

    // 模拟编辑器发出选区变化事件
    act(() => {
      handlers['selectionUpdate']?.()
    })

    expect(screen.getByTitle('加粗')).toBeInTheDocument()
    expect(screen.getByTitle('斜体')).toBeInTheDocument()
    expect(screen.getByText('AI 润色')).toBeInTheDocument()
  })

  it('编辑器无 on/off（或已销毁）时不附加监听、不崩溃', () => {
    const { editor } = makeEditor({ from: 0, to: 5 })
    delete editor.on
    delete editor.off
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })

  it('creates a proposal and applies Accept then Undo through the editor boundary', async () => {
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
    const { chapterMutationService } = await import('../../services/defaultChapterMutationService')
    const mutateSpy = vi.spyOn(chapterMutationService, 'mutate').mockResolvedValueOnce({
      success: false,
      conflict: true,
      currentRevision: 99,
      error: 'CAS Conflict: expected revision 4, but current revision is 99',
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

    // 验证：由于落库失败，事务阻断，状态转为 stale 且展示冲突错误，编辑器内容保持不变
    await waitFor(() => {
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('stale')
      expect(screen.getByTestId('rewrite-proposal-preview')).toHaveTextContent('提案版本冲突')
    })
    expect(getContent()).toBe('选中文本')

    mutateSpy.mockRestore()
  })
})

>>>>>>> theirs
