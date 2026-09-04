import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Bookshelf } from './Bookshelf'

describe('Bookshelf (InkPi 主页)', () => {
  it('显示主页 Header 标题与空项目占位提示', () => {
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={vi.fn()} />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    expect(screen.getByText('AI 驱动的现代小说创作工作台')).toBeInTheDocument()
    expect(screen.getByText(/我的作品 \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('还没有作品，点击右上角「新建小说项目」开启第一本书')).toBeInTheDocument()
  })

  it('渲染项目卡片并点击打开项目', () => {
    const onOpen = vi.fn()
    render(
      <Bookshelf
        projects={[
          { id: 'p1', name: '吞天神脉', genre: '东方玄幻', intro: '废脉？我吞的就是天！', updatedAt: Date.now() },
        ]}
        onOpenProject={onOpen}
        onCreateProject={vi.fn()}
        onExportProject={vi.fn()}
        onUpdateProject={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    )
    expect(screen.getByText('吞天神脉')).toBeInTheDocument()
    expect(screen.getByText('废脉？我吞的就是天！')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('打开项目'))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('新建项目面板展开并收集信息回调', async () => {
    const onCreate = vi.fn()
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    expect(screen.getByText('项目形态')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '吞天神脉（测试）' },
    })
    fireEvent.click(screen.getByText('创建并进入项目'))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('吞天神脉（测试）', '东方玄幻', ''))
  })

  it('不渲染创建示范项目等外来冗余按钮', () => {
    render(
      <Bookshelf
        projects={[]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
      />,
    )
    expect(screen.queryByText('创建示范项目')).not.toBeInTheDocument()
  })

  it('项目卡片支持导出备份、编辑信息、删除项目', async () => {
    const onExport = vi.fn()
    const onUpdate = vi.fn()
    const onDelete = vi.fn()
    render(
      <Bookshelf
        projects={[{ id: 'p1', name: '吞天神脉', genre: '东方玄幻', intro: '测试简介', updatedAt: Date.now() }]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onExportProject={onExport}
        onUpdateProject={onUpdate}
        onDeleteProject={onDelete}
      />,
    )

    fireEvent.click(screen.getByTitle('导出 JSON 备份'))
    expect(onExport).toHaveBeenCalledWith('p1')

    // 打开更多操作菜单触发编辑
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.click(screen.getByTitle('编辑信息'))
    fireEvent.change(screen.getByDisplayValue('吞天神脉'), { target: { value: '吞天神脉·第二部' } })
    fireEvent.change(screen.getByDisplayValue('东方玄幻'), { target: { value: '仙侠修真' } })
    fireEvent.change(screen.getByDisplayValue('测试简介'), { target: { value: '全新篇章开启' } })
    fireEvent.click(screen.getByText('保存作品信息'))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'p1',
          name: '吞天神脉·第二部',
          genre: '仙侠修真',
          intro: '全新篇章开启',
        }),
      ),
    )

    // 打开更多操作菜单触发删除
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.click(screen.getByTitle('删除作品'))
    fireEvent.click(screen.getByText('确认删除'))
    expect(onDelete).toHaveBeenCalledWith('p1')
  })
})

