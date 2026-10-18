import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TimelineGridView } from './TimelineGridView'
import { db } from '../../../db/indexedDB'
import { timelineApplicationService } from '../../../services/domainApplicationServices'

describe('TimelineGridView — 时空因果大纲网格主视口', () => {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(async () => {
    const [threads, nodes] = await Promise.all([
      db.getAll<{ id: string }>('narrativeThreads'),
      db.getAll<{ id: string }>('timelineNodes'),
    ])
    await Promise.all([
      ...threads.map((t) => db.delete('narrativeThreads', t.id)),
      ...nodes.map((n) => db.delete('timelineNodes', n.id)),
    ])
  })

  it('renders empty state when no threads or nodes exist and allows seeding demo', async () => {
    render(<TimelineGridView projectId="p1" />)
    expect(await screen.findByText('尚无时空大纲网格')).toBeInTheDocument()

    fireEvent.click(screen.getByText('预载修仙多线因果网格示例'))
    await waitFor(() => {
      expect(screen.getByText('主线 / 逆天修仙')).toBeInTheDocument()
      expect(screen.getByText('后山受辱，偶得残破小鼎')).toBeInTheDocument()
    })
  })

  it('allows adding a new timeline event node', async () => {
    render(<TimelineGridView projectId="p1" />)
    await screen.findByText('尚无时空大纲网格')
    fireEvent.click(screen.getByText('预载修仙多线因果网格示例'))
    await screen.findByText('主线 / 逆天修仙')

    fireEvent.click(screen.getByText('添加大纲事件'))
    expect(await screen.findByText('新建大纲事件节点')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/如：断界渊试炼/), {
      target: { value: '九霄秘境寻宝' },
    })
    fireEvent.click(screen.getByText('保存事件'))

    await waitFor(() => {
      expect(screen.getByText('九霄秘境寻宝')).toBeInTheDocument()
    })
  })

  it('keeps an event with no chapter or narrative thread visible and editable', async () => {
    await db.put('timelineNodes', {
      id: 'unplaced',
      projectId: 'p1',
      threadId: 'missing-thread',
      chapterOrder: 0,
      eventTitle: '待定位的事件',
      summary: '作者尚未确定位置',
      status: 'drafted',
      prerequisites: [],
      causalOutcome: '',
      relatedEntityIds: [],
      emotionalPolarity: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    render(<TimelineGridView projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: '定位事件：待定位的事件' }))
    expect(await screen.findByText('编辑时空大纲事件')).toBeInTheDocument()
    expect(screen.getByDisplayValue('待定位的事件')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: '所在章节' }), {
      target: { value: '1' },
    })
    expect(screen.getByText('保存事件')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '建立主线' }))
    await waitFor(() => expect(screen.getByText('保存事件')).toBeEnabled())
    fireEvent.click(screen.getByText('保存事件'))
    await waitFor(() => expect(screen.queryByText('编辑时空大纲事件')).not.toBeInTheDocument())
    const saved = await db.get<any>('timelineNodes', 'unplaced')
    expect(saved.chapterOrder).toBe(1)
    expect((await db.get<any>('narrativeThreads', saved.threadId))?.name).toBe('主线')
    expect(screen.queryByRole('button', { name: '定位事件：待定位的事件' })).not.toBeInTheDocument()
  })

  it('does not infer a same-line collision for events whose thread record is missing', async () => {
    await Promise.all(
      ['orphan-a', 'orphan-b'].map((id) =>
        db.put('timelineNodes', {
          id,
          projectId: 'p1',
          threadId: 'missing-thread',
          chapterOrder: 2,
          eventTitle: id,
          summary: '',
          status: 'planned',
          prerequisites: [],
          causalOutcome: '',
          relatedEntityIds: [],
          emotionalPolarity: 0,
          createdAt: 1,
          updatedAt: 1,
        }),
      ),
    )

    render(<TimelineGridView projectId="p1" />)

    expect(await screen.findByRole('button', { name: '定位事件：orphan-a' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '定位事件：orphan-b' })).toBeInTheDocument()
    expect(screen.getByText('因果门禁 (0)')).toBeInTheDocument()
  })

  it('retains the draft and does not recreate a thread after an event save fails', async () => {
    const saveNode = vi
      .spyOn(timelineApplicationService, 'saveNode')
      .mockRejectedValueOnce(new Error('storage unavailable'))
    render(<TimelineGridView projectId="p1" />)
    await screen.findByText('尚无时空大纲网格')
    fireEvent.click(screen.getByText('添加大纲事件'))
    fireEvent.change(screen.getByPlaceholderText(/如：断界渊试炼/), {
      target: { value: '作者保留的事件' },
    })
    fireEvent.click(screen.getByRole('button', { name: '建立主线' }))
    await waitFor(() => expect(screen.getByText('保存事件')).toBeEnabled())
    fireEvent.click(screen.getByText('保存事件'))
    expect(await screen.findByRole('alert')).toHaveTextContent('事件未能保存，请重试')
    expect(screen.getByDisplayValue('作者保留的事件')).toBeInTheDocument()
    expect(await db.getAll('timelineNodes')).toHaveLength(0)
    expect(await db.getAll('narrativeThreads')).toHaveLength(1)
    fireEvent.click(screen.getByText('保存事件'))
    await waitFor(() => expect(screen.queryByText('新建大纲事件节点')).not.toBeInTheDocument())
    expect(saveNode).toHaveBeenCalledTimes(2)
    expect(await db.getAll('narrativeThreads')).toHaveLength(1)
    expect(await db.getAll('timelineNodes')).toHaveLength(1)
  })

  it('toggles conflict panel display and shows causal gate status', async () => {
    render(<TimelineGridView projectId="p1" />)
    await screen.findByText('尚无时空大纲网格')
    fireEvent.click(screen.getByText('预载修仙多线因果网格示例'))
    await screen.findByText('主线 / 逆天修仙')

    expect(screen.getByText('时空因果质检门禁')).toBeInTheDocument()
    expect(screen.getByText('当前检查未发现冲突')).toBeInTheDocument()

    // 切换折叠门禁面板
    fireEvent.click(screen.getByText(/因果门禁/))
    expect(screen.queryByText('时空因果质检门禁')).not.toBeInTheDocument()
  })
})
