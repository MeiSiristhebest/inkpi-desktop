import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TimelineGridView } from './TimelineGridView'
import { db } from '../../../db/indexedDB'

describe('TimelineGridView — 时空因果大纲网格主视口', () => {
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

  it('toggles conflict panel display and shows causal gate status', async () => {
    render(<TimelineGridView projectId="p1" />)
    await screen.findByText('尚无时空大纲网格')
    fireEvent.click(screen.getByText('预载修仙多线因果网格示例'))
    await screen.findByText('主线 / 逆天修仙')

    expect(screen.getByText('时空因果质检门禁')).toBeInTheDocument()
    expect(screen.getByText('时空因果完全自洽')).toBeInTheDocument()

    // 切换折叠门禁面板
    fireEvent.click(screen.getByText(/因果门禁/))
    expect(screen.queryByText('时空因果质检门禁')).not.toBeInTheDocument()
  })
})
