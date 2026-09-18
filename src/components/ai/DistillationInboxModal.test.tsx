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
      evidence: [{ documentId: 'doc-1', excerpt: '诛仙剑光万丈' }],
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
})
