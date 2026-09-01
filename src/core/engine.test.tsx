import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Engine } from './engine'
import { db } from '../db/indexedDB'

afterEach(() => cleanup())

describe('Engine — 主视口路由与多栏布局', () => {
  it('mounts the writing desk for the editor view by default', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('switches to form/table placeholders and isolates the editor', () => {
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByText('表单视图'))
    // 占位容器描述文案唯一，可避免与左侧导航标签重名
    expect(screen.getByText('结构化表单容器（建设中）')).toBeInTheDocument()
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('表格视图'))
    expect(screen.getByText('数据表格容器（建设中）')).toBeInTheDocument()

    fireEvent.click(screen.getByText('正文写作'))
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('toggles the left navigation panel', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('工作台')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('折叠/展开导航'))
    expect(screen.queryByText('工作台')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('折叠/展开导航'))
    expect(screen.getByText('工作台')).toBeInTheDocument()
  })

  it('toggles the right info panel', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('文档信息')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('折叠/展开信息栏'))
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('折叠/展开信息栏'))
    expect(screen.getByText('文档信息')).toBeInTheDocument()
  })

  it('toggles the typewriter viewport active state', () => {
    render(<Engine projectId="p1" />)
    const btn = screen.getByTitle('打字机视口')
    fireEvent.click(btn)
    expect(btn.className).toMatch(/text-\[var\(--ink-accent\)\]/)
  })

  it('hides the side panels in fullscreen mode', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('工作台')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('全屏 / 退出全屏'))
    expect(screen.queryByText('工作台')).not.toBeInTheDocument()
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('全屏 / 退出全屏'))
    expect(screen.getByText('工作台')).toBeInTheDocument()
  })

  it('invokes onBack when the back button is clicked', () => {
    const onBack = vi.fn()
    render(<Engine projectId="p1" onBack={onBack} />)
    fireEvent.click(screen.getByText('返回笔记'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('formats the last-updated time when a chapter carries updatedAt', async () => {
    const pid = 'p-engine-stats'
    await db.put('volumes', { id: 'vStats', projectId: pid, title: 'V', order: 0, createdAt: 1, updatedAt: 1 })
    await db.put('chapters', {
      id: 'cStats',
      projectId: pid,
      volumeId: 'vStats',
      title: 'C',
      content: 'x',
      wordCount: 1,
      order: 0,
      createdAt: 1,
      updatedAt: Date.now(),
    })
    render(<Engine projectId={pid} />)
    // 精确匹配右侧信息栏的「最后更新」标签（写作台状态栏也有「最后更新：…」会重名）
    const label = await screen.findByText('最后更新', { exact: true })
    // 覆盖 stats.updatedAt 有值时的格式化分支（非占位 '—'）
    // 注意：Row 把 label 与 value 拆成两个 span，'—' 在 value span，需查整行
    const row = label.parentElement as HTMLElement
    await waitFor(() => expect(row.textContent).not.toContain('—'))
    await db.delete('volumes', 'vStats')
    await db.delete('chapters', 'cStats')
  })

  it('switches to installed plugin view (living-codex) and mounts its main view', async () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('业务插件')).toBeInTheDocument()
    expect(screen.getByText('活体世界观')).toBeInTheDocument()

    fireEvent.click(screen.getByText('活体世界观'))
    expect(await screen.findByText('活体世界观实体图谱')).toBeInTheDocument()
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
  })
})
