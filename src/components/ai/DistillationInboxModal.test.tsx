import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DistillationInboxModal } from './DistillationInboxModal'
import type { DistillationItem } from '../../ai/proposals/distillationReviewInbox'

describe('DistillationInboxModal Component', () => {
  const mockItems: DistillationItem[] = [
    {
      id: 'item-1',
      workspaceId: 'ws-1',
      taskId: 'task-1',
      category: 'entity',
      name: '诛仙剑',
      summary: '上古神兵',
      kind: 'item',
      confidence: 0.95,
      sourceDocumentId: 'doc-1',
      sourceBlockId: 'block-1',
      sourceRevision: 4,
      evidence: [
        {
          documentId: 'doc-1',
          blockId: 'block-1',
          excerpt: '诛仙剑光万丈',
          semanticFrom: 10,
          semanticTo: 16,
        },
      ],
      status: 'pending',
      createdAt: 1000,
    },
    {
      id: 'item-2',
      workspaceId: 'ws-1',
      taskId: 'task-1',
      category: 'event',
      name: '青云大战',
      summary: '正魔大战',
      confidence: 0.88,
      status: 'pending',
      createdAt: 1100,
    },
  ]

  it('renders modal with items and categories', () => {
    render(
      <DistillationInboxModal
        items={mockItems}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('诛仙剑')).toBeInTheDocument()
    expect(screen.getByText('实体 · item')).toBeInTheDocument()
    expect(screen.getByText('青云大战')).toBeInTheDocument()
    expect(screen.getByText('事件 · 时空')).toBeInTheDocument()
    expect(screen.getByText('“诛仙剑光万丈”')).toBeInTheDocument()
    expect(screen.getByText('来源：文档 doc-1 · 段落 block-1 · 修订 4')).toBeInTheDocument()
    expect(screen.getByText('尚无已核对的原文出处')).toBeInTheDocument()
  })

  it('marks changed sources stale and opens their source through the editor callback', async () => {
    const onOpenSource = vi.fn().mockResolvedValue({ status: 'opened', highlighted: true })
    const onClose = vi.fn()
    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        sourceChapters={[{ id: 'doc-1', revision: 5 }]}
        onOpenSource={onOpenSource}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('原文已变更')
    fireEvent.click(screen.getByRole('button', { name: '查看原文：诛仙剑' }))

    await waitFor(() => {
      expect(onOpenSource).toHaveBeenCalledWith({
        documentId: 'doc-1',
        blockId: 'block-1',
        sourceRevision: 4,
        excerpt: '诛仙剑光万丈',
        semanticFrom: 10,
        semanticTo: 16,
      })
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('reports when an updated source quote cannot be located uniquely', async () => {
    const onOpenSource = vi.fn().mockResolvedValue({ status: 'opened', highlighted: false })
    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        sourceChapters={[{ id: 'doc-1', revision: 5 }]}
        onOpenSource={onOpenSource}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '查看原文：诛仙剑' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('原文引用已变更或不唯一')
  })

  it('handles direct accept and reject callbacks', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)
    const onReject = vi.fn()
    const onClose = vi.fn()

    render(
      <DistillationInboxModal
        items={mockItems}
        onAccept={onAccept}
        onReject={onReject}
        onClose={onClose}
      />,
    )

    const acceptButtons = screen.getAllByRole('button', { name: '采纳' })
    fireEvent.click(acceptButtons[0])
    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith('item-1')
    })

    const rejectButtons = screen.getAllByRole('button', { name: '拒绝' })
    fireEvent.click(rejectButtons[1])
    expect(onReject).toHaveBeenCalledWith('item-2')
  })

  it('handles edit and save-and-accept', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)

    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        onAccept={onAccept}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))

    const nameInput = screen.getByPlaceholderText('设定名称')
    fireEvent.change(nameInput, { target: { value: '诛仙古剑' } })

    fireEvent.click(screen.getByRole('button', { name: '保存并采纳' }))

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith('item-1', {
        name: '诛仙古剑',
        summary: '上古神兵',
      })
    })
  })

  it('handles hypothesis and merge callbacks', async () => {
    const onKeepHypothesis = vi.fn().mockResolvedValue(undefined)
    const onMerge = vi.fn().mockResolvedValue(undefined)

    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        onAccept={vi.fn()}
        onKeepHypothesis={onKeepHypothesis}
        onMerge={onMerge}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '保留为推测' }))
    await waitFor(() => {
      expect(onKeepHypothesis).toHaveBeenCalledWith('item-1')
    })

    fireEvent.click(screen.getByRole('button', { name: '合并已有实体' }))
    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledWith('item-1')
    })
  })

  it('shows empty placeholder when items list is empty', () => {
    render(
      <DistillationInboxModal items={[]} onAccept={vi.fn()} onReject={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByText('暂无待审查的 AI 提炼事实')).toBeInTheDocument()
  })

  it('shows an accept failure and allows retrying the same item', async () => {
    const onAccept = vi
      .fn()
      .mockRejectedValueOnce(new Error('存储写入失败'))
      .mockResolvedValue(undefined)
    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        onAccept={onAccept}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '采纳' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('采纳失败：存储写入失败')
    fireEvent.click(screen.getByRole('button', { name: '采纳' }))
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(onAccept.mock.calls).toEqual([['item-1'], ['item-1']])
  })

  it('keeps edited text when save-and-accept fails', async () => {
    const onAccept = vi.fn().mockRejectedValue(new Error('保存失败'))
    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        onAccept={onAccept}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    fireEvent.change(screen.getByPlaceholderText('设定名称'), { target: { value: '改过的名称' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并采纳' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('采纳失败：保存失败')
    expect(screen.getByPlaceholderText('设定名称')).toHaveValue('改过的名称')
    expect(screen.getByRole('button', { name: '保存并采纳' })).toBeEnabled()
  })

  it('shows a reject failure without dropping the review item', async () => {
    const onReject = vi.fn().mockRejectedValue(new Error('拒绝记录未保存'))
    render(
      <DistillationInboxModal
        items={[mockItems[0]]}
        onAccept={vi.fn()}
        onReject={onReject}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '拒绝' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('拒绝失败：拒绝记录未保存')
    expect(screen.getByText('诛仙剑')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝' })).toBeEnabled()
  })

  it('lets the author place an unsourced event without inventing source evidence', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)
    render(
      <DistillationInboxModal
        items={[mockItems[1]]}
        sourceChapters={[{ id: 'chapter-2', revision: 3, title: '山雨' }]}
        onAccept={onAccept}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/没有可用的来源章节，采纳后暂不指定章节/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '青云大战的章节位置' }), {
      target: { value: 'chapter-2' },
    })
    fireEvent.click(screen.getByRole('button', { name: '采纳' }))
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith('item-2', { chapterId: 'chapter-2' }))
    expect(screen.getByText('尚无已核对的原文出处')).toBeInTheDocument()
  })

  it('disables competing review actions while a write is in progress', async () => {
    let finish!: () => void
    const onAccept = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <DistillationInboxModal
        items={mockItems}
        onAccept={onAccept}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: '采纳' })[0])
    expect(
      screen
        .getAllByRole('button', { name: '拒绝' })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true)
    expect(
      screen
        .getAllByRole('button', { name: '编辑' })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true)
    finish()
    await waitFor(() => expect(screen.getAllByRole('button', { name: '采纳' })[0]).toBeEnabled())
  })
})
