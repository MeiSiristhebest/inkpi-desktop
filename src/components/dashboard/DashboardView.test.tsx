import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { DashboardView } from './DashboardView'
import { db } from '../../db/indexedDB'
import { indexedDbDailyStatsRepository } from '../../adapters/indexedDbDailyStatsRepository'

afterEach(async () => {
  cleanup()
  for (const stat of await db.getAll<{ key: string; projectId: string }>('dailyStats')) {
    if (stat.projectId === 'p-dash') await db.delete('dailyStats', stat.key)
  }
})

describe('DashboardView', () => {
  it('renders the writing panel with stat cards and quick entries', async () => {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    await db.put('projects', {
      id: 'p-dash',
      name: '示范',
      genre: '仙侠修真',
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('volumes', {
      id: 'v1',
      projectId: 'p-dash',
      title: '第一卷 风起',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('chapters', {
      id: 'c1',
      projectId: 'p-dash',
      volumeId: 'v1',
      title: '第001章 开篇',
      content: 'x',
      wordCount: 100,
      order: 0,
      status: 'published',
      createdAt: 1,
      updatedAt: Date.now(),
    })
    await db.put('dailyStats', {
      key: `p-dash::${date}`,
      projectId: 'p-dash',
      date,
      words: 23,
    })

    render(<DashboardView projectId="p-dash" onOpenView={vi.fn()} />)

    expect(await screen.findByText('今日产出 23 字 · 本机统计')).toBeInTheDocument()
    await indexedDbDailyStatsRepository.recordDailyWords('p-dash', 5)
    await waitFor(() => expect(screen.getByText('今日产出 28 字 · 本机统计')).toBeInTheDocument())

    expect(screen.getByRole('heading', { name: '写作面板' })).toBeInTheDocument()
    expect(screen.getByText('累计字数')).toBeInTheDocument()
    expect(screen.getByText('完稿章节')).toBeInTheDocument()
    expect(screen.getAllByText('未回收伏笔').length).toBeGreaterThan(0)
    expect(screen.getByText('近 7 日产量')).toBeInTheDocument()
    expect(screen.getByText('码字活动')).toBeInTheDocument()
    expect(screen.getByText('快捷入口')).toBeInTheDocument()
    expect(screen.getByText('分卷进度')).toBeInTheDocument()
    expect(screen.getByText('创作状态提醒')).toBeInTheDocument()

    // 真实快捷入口 6 大高频页签
    expect(screen.getByText('正文编辑')).toBeInTheDocument()
    expect(screen.getByText('章节总表')).toBeInTheDocument()
    expect(screen.getByText('伏笔追踪')).toBeInTheDocument()
    expect(screen.getByText('时间脉络')).toBeInTheDocument()
    expect(screen.getByText('爽点节奏')).toBeInTheDocument()
    expect(screen.getByText('灵感素材')).toBeInTheDocument()

    await db.delete('chapters', 'c1')
    await db.delete('volumes', 'v1')
    await db.delete('projects', 'p-dash')
  })
})
