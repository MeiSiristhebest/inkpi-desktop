import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { DashboardView } from './DashboardView'
import { db } from '../../db/indexedDB'
import { indexedDbDailyStatsRepository } from '../../adapters/indexedDbDailyStatsRepository'
import { indexedDbSettingsKVRepository } from '../../adapters/indexedDbSettingsKVRepository'
import { lastActiveChapterKey } from '../../lib/resumePointer'
import { PROJECT_START_GUIDE_STORAGE_KEY } from '../../plugins/project-compass/components/ProjectStartGuide'

afterEach(async () => {
  cleanup()
  for (const stat of await db.getAll<{ key: string; projectId: string }>('dailyStats')) {
    if (stat.projectId === 'p-dash') await db.delete('dailyStats', stat.key)
  }
  for (const card of await db.getAll<{ id: string; projectId: string }>('cardRecords')) {
    if (card.projectId === 'p-dash') await db.delete('cardRecords', card.id)
  }
  for (const row of await db.getAll<{ id: string; projectId: string }>('tableRows')) {
    if (row.projectId === 'p-dash') await db.delete('tableRows', row.id)
  }
  localStorage.removeItem(lastActiveChapterKey('p-dash'))
  await indexedDbSettingsKVRepository.remove('p-dash', PROJECT_START_GUIDE_STORAGE_KEY)
  await db.delete('formData', 'p-dash::positioning')
  await db.delete('formData', 'p-dash::worldbase')
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
      content: '<p>主角登场</p>',
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
    await db.put('cardRecords', {
      id: 'card-dash',
      projectId: 'p-dash',
      tabId: 'char-main',
      name: '主角',
      data: {},
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('tableRows', {
      id: 'row-foreshadow-dash',
      projectId: 'p-dash',
      tabId: 'foreshadow',
      data: { 状态: '未回收' },
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('tableRows', {
      id: 'row-idea-dash',
      projectId: 'p-dash',
      tabId: 'ideas',
      data: { 状态: '未用' },
      createdAt: 1,
      updatedAt: 1,
    })
    localStorage.setItem(lastActiveChapterKey('p-dash'), 'c1')

    const onOpenChapter = vi.fn()
    const onOpenView = vi.fn()
    render(
      <DashboardView projectId="p-dash" onOpenView={onOpenView} onOpenChapter={onOpenChapter} />,
    )

    expect(await screen.findByText('今日产出 23 字 · 本机统计')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: '打开世界设定' }, { timeout: 5_000 }),
    ).toBeInTheDocument()
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
    expect(screen.getByTestId('dashboard-next-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续上次写作《第001章 开篇》' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看 1 条未回收伏笔' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看 1 条未用灵感' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看 1 条未回收伏笔' }))
    fireEvent.click(screen.getByRole('button', { name: '查看 1 条未用灵感' }))
    expect(onOpenView).toHaveBeenNthCalledWith(1, 'foreshadow')
    expect(onOpenView).toHaveBeenNthCalledWith(2, 'ideas')
    fireEvent.click(screen.getByRole('button', { name: '打开世界设定' }))
    expect(onOpenView).toHaveBeenNthCalledWith(3, 'worldbase')

    // 真实快捷入口 6 大高频页签
    expect(screen.getByText('正文编辑')).toBeInTheDocument()
    expect(screen.getByText('章节总表')).toBeInTheDocument()
    expect(screen.getByText('伏笔追踪')).toBeInTheDocument()
    expect(screen.getByText('时间脉络')).toBeInTheDocument()
    expect(screen.getByText('爽点节奏')).toBeInTheDocument()
    expect(screen.getByText('灵感素材')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开《第001章 开篇》正文' }))
    fireEvent.click(screen.getByRole('button', { name: '在《第001章 开篇》中查看主角的出场位置' }))
    fireEvent.click(screen.getByRole('button', { name: '继续上次写作《第001章 开篇》' }))
    expect(onOpenChapter).toHaveBeenNthCalledWith(1, 'c1')
    expect(onOpenChapter).toHaveBeenNthCalledWith(2, 'c1')
    expect(onOpenChapter).toHaveBeenNthCalledWith(3, 'c1')

    await db.delete('chapters', 'c1')
    await db.delete('volumes', 'v1')
    await db.delete('projects', 'p-dash')
  })
})
