import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { Bookshelf } from './Bookshelf'
import { RECOMMENDED_PLUGIN_IDS } from '../../domain/project/projectDefaults'

describe('Bookshelf (InkPi 主页)', () => {
  it('显示主页 Header 标题与空项目占位提示', () => {
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={vi.fn()} />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    expect(screen.getByText('AI 驱动的现代小说创作工作台')).toBeInTheDocument()
    expect(screen.getByText(/我的作品 \(0\)/)).toBeInTheDocument()
    expect(
      screen.getByText('还没有作品，点击右上角「新建小说项目」开启第一本书'),
    ).toBeInTheDocument()
  })

  it('显示完整备份失败状态并允许关闭提示', () => {
    const onDismiss = vi.fn()
    render(
      <Bookshelf
        projects={[]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        exportError="完整备份失败，未生成备份文件。无法读取必要数据。"
        onDismissExportError={onDismiss}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('完整备份失败，未生成备份文件。')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: '关闭' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('渲染项目卡片并点击打开项目', () => {
    const onOpen = vi.fn()
    render(
      <Bookshelf
        projects={[
          {
            id: 'p1',
            name: '吞天神脉',
            genre: '东方玄幻',
            intro: '废脉？我吞的就是天！',
            updatedAt: Date.now(),
          },
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
    fireEvent.click(screen.getByRole('button', { name: '打开项目' }))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('卡片底栏按"上次编辑 2 小时前"这类间隔来读，而不是日历日期（P3.7）', () => {
    render(
      <Bookshelf
        projects={[
          {
            id: 'p7',
            name: '时雨集',
            genre: '都市',
            createdAt: 1,
            updatedAt: Date.now() - (2 * 3_600_000 + 60_000),
          },
        ]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
      />,
    )

    expect(screen.getByText('上次编辑 2 小时前')).toBeInTheDocument()
    expect(screen.queryByText(/更新于/)).not.toBeInTheDocument()
    // 章数尚未加载完时不承诺"继续写作"，等 stats 到位再换文案
    expect(screen.getByRole('button', { name: '打开项目' })).toBeInTheDocument()
  })

  it('书名之外全是可选：不展开「更多设置」就按摘要念出的默认值创建（§P3.6）', async () => {
    const onCreate = vi.fn()
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    // 折叠着也不能藏着生效的选择 —— 摘要必须把默认值念出来
    expect(screen.getByTestId('creation-advanced-toggle').textContent).toContain(
      `空白作品 · ${RECOMMENDED_PLUGIN_IDS.length} 件工具 · 题材未定`,
    )
    expect(screen.queryByTestId('tooling-catalog')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '吞天神脉（测试）' },
    })
    fireEvent.click(screen.getByText('创建并进入项目'))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: '吞天神脉（测试）',
        genre: '',
        cover: '',
        starter: 'blank',
        tooling: 'recommended',
        customPluginIds: RECOMMENDED_PLUGIN_IDS,
      }),
    )
  })

  it('shows the shared Button busy state while project creation is pending', async () => {
    let finishCreation!: () => void
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCreation = resolve
        }),
    )
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '忙碌状态作品' },
    })

    const createButton = screen.getByRole('button', { name: '创建并进入项目' })
    expect(createButton).toHaveAttribute('data-slot', 'button')
    fireEvent.click(createButton)

    const busyButton = screen.getByRole('button', { name: '正在创建…' })
    expect(busyButton).toBeDisabled()
    expect(busyButton).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(busyButton)
    expect(onCreate).toHaveBeenCalledOnce()

    finishCreation()
    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce())
  })

  it('创建失败时保留表单并允许重试', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'))
      .mockResolvedValueOnce(undefined)
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    const nameInput = screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补')
    fireEvent.change(nameInput, { target: { value: '故障重试作品' } })
    fireEvent.click(screen.getByText('创建并进入项目'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '创建失败，表单内容已保留。IndexedDB unavailable',
    )
    expect(nameInput).toHaveValue('故障重试作品')
    fireEvent.click(screen.getByText('创建并进入项目'))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2))
  })

  it('导入时阻止重复提交，失败后显示原因并允许重新选择文件', async () => {
    let failImport!: () => void
    const onImportProject = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            failImport = () => reject(new Error('无效 JSON'))
          }),
      )
      .mockResolvedValueOnce(undefined)
    const { container } = render(
      <Bookshelf
        projects={[]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onImportProject={onImportProject}
      />,
    )
    const input = container.querySelector<HTMLInputElement>(
      'input[accept="application/json,.json"]',
    )
    expect(input).not.toBeNull()
    const file = new File(['{'], 'broken.json', { type: 'application/json' })
    fireEvent.change(input!, {
      target: { files: [file] },
    })

    const busyButton = screen.getByRole('button', { name: '正在导入…' })
    expect(busyButton).toBeDisabled()
    fireEvent.click(busyButton)
    expect(onImportProject).toHaveBeenCalledOnce()
    failImport()

    expect(await screen.findByRole('alert')).toHaveTextContent('导入失败，原文件可重试。无效 JSON')
    expect(input).toHaveValue('')
    fireEvent.change(input!, { target: { files: [file] } })
    await waitFor(() => expect(onImportProject).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('示范样例、题材与工具组合各自是一次真实选择，全部回传给创建流程（§P3.6）', async () => {
    const onCreate = vi.fn()
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    fireEvent.click(screen.getByTestId('creation-advanced-toggle'))
    fireEvent.click(screen.getByText('示范样例（苍澜纪元）'))
    fireEvent.click(screen.getByText('科幻'))
    fireEvent.click(screen.getByTestId('tooling-lite'))
    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '苍澜测试' },
    })
    fireEvent.click(screen.getByText('创建并进入项目'))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '苍澜测试',
          genre: '科幻',
          starter: 'demo',
          tooling: 'lite',
        }),
      ),
    )
  })

  it('「自定义」当场展开工具全集，勾掉的那件不再交给新书', async () => {
    const onCreate = vi.fn()
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    fireEvent.click(screen.getByTestId('creation-advanced-toggle'))
    fireEvent.click(screen.getByTestId('tooling-custom'))

    const catalog = await screen.findByTestId('tooling-catalog')
    const water = within(catalog).getByRole('checkbox', { name: '字数水分表' })
    fireEvent.click(water)
    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '挑着写' },
    })
    fireEvent.click(screen.getByText('创建并进入项目'))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const ids: readonly string[] = onCreate.mock.calls[0][0].customPluginIds
    expect(ids).toContain('living-codex')
    expect(ids).not.toContain('water-meter')
  })

  it('上传的封面跟着项目走，不是选完就丢的临时预览（§P3.6）', async () => {
    const onCreate = vi.fn()
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={onCreate} />)

    fireEvent.click(screen.getByText('新建小说项目'))
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'cover.png', {
      type: 'image/png',
    })
    fireEvent.change(screen.getByTestId('creation-cover-input'), { target: { files: [file] } })
    await screen.findByAltText('封面预览')

    fireEvent.change(screen.getByPlaceholderText('给这本书起个名字，其他信息之后随时可以补'), {
      target: { value: '有封面的书' },
    })
    fireEvent.click(screen.getByText('创建并进入项目'))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(onCreate.mock.calls[0][0].cover).toMatch(/^data:image\/png/)
  })

  it('不渲染创建示范项目等外来冗余按钮', () => {
    render(<Bookshelf projects={[]} onOpenProject={vi.fn()} onCreateProject={vi.fn()} />)
    expect(screen.queryByText('创建示范项目')).not.toBeInTheDocument()
  })

  it('项目卡片支持导出备份、编辑信息、删除项目', async () => {
    const onExport = vi.fn()
    const onExportManuscript = vi.fn()
    const onRemoveFromLibrary = vi.fn()
    const onUpdate = vi.fn()
    const onDelete = vi.fn()
    render(
      <Bookshelf
        projects={[
          {
            id: 'p1',
            name: '吞天神脉',
            genre: '东方玄幻',
            intro: '测试简介',
            createdAt: 1,
            updatedAt: Date.now(),
          },
        ]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onExportProject={onExport}
        onExportManuscript={onExportManuscript}
        onRemoveFromLibrary={onRemoveFromLibrary}
        onUpdateProject={onUpdate}
        onDeleteProject={onDelete}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: '导出完整备份（含设定/时间线/插件/AI 数据）' }),
    )
    expect(onExport).toHaveBeenCalledWith('p1')

    // 打开更多操作菜单触发编辑（菜单条目是 menuitem，不是 button）
    const moreActions = screen.getByRole('button', { name: '更多操作' })
    expect(moreActions).toHaveAttribute('aria-haspopup', 'menu')
    expect(moreActions).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(moreActions)
    expect(screen.getByRole('button', { name: '更多操作' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '编辑信息' }))
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

    // 两种导出是两个产物：菜单里各占一项，回调互不复用
    // 「更多操作」是按钮，菜单里的条目是 menuitem，确认弹窗的按钮才回到 button 角色
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '导出正文' }))
    expect(onExportManuscript).toHaveBeenCalledWith('p1')

    // 移出作品库：只隐藏，绝不能顺带触发 purge
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '移出作品库' }))
    expect(screen.getByRole('heading', { name: '移出作品库' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '移出作品库' }))
    await waitFor(() => expect(onRemoveFromLibrary).toHaveBeenCalledWith('p1'))
    expect(onDelete).not.toHaveBeenCalled()

    // 永久删除：必须二次确认，且确认文案如实说明清除范围
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '永久删除' }))
    expect(screen.getByText('永久删除作品')).toBeInTheDocument()
    expect(screen.getByText(/不可撤销/)).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('p1'))
  })

  it('keeps project editing open while the update is pending and closes after it resolves', async () => {
    let finishUpdate!: () => void
    const onUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve
        }),
    )
    render(
      <Bookshelf
        projects={[
          {
            id: 'p1',
            name: '待保存作品',
            createdAt: 1,
            updatedAt: Date.now(),
          },
        ]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onUpdateProject={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '编辑信息' }))
    fireEvent.change(screen.getByPlaceholderText('请输入作品名称'), {
      target: { value: '已提交作品' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存作品信息' }))

    expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled()
    expect(screen.getByPlaceholderText('请输入作品名称')).toHaveValue('已提交作品')
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', name: '已提交作品' }))

    finishUpdate()
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('请输入作品名称')).not.toBeInTheDocument(),
    )
  })

  it('已移出作品库只列出隐藏条目，并提供放回与永久删除两个出口', async () => {
    const onRestore = vi.fn()
    const onDelete = vi.fn()
    render(
      <Bookshelf
        projects={[]}
        archivedProjects={[
          {
            id: 'p9',
            name: '收起的书',
            genre: '科幻',
            createdAt: 1,
            updatedAt: 1,
            archivedAt: 2,
          },
        ]}
        onOpenProject={vi.fn()}
        onCreateProject={vi.fn()}
        onRestoreToLibrary={onRestore}
        onDeleteProject={onDelete}
      />,
    )

    const section = screen.getByLabelText('已移出作品库')
    expect(section).toBeInTheDocument()
    expect(within(section).getByText('收起的书')).toBeInTheDocument()
    // 书架上的作品卡片不应出现：隐藏条目只活在归档区
    expect(screen.queryByText('进入写作')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '放回书架' }))
    expect(onRestore).toHaveBeenCalledWith('p9')
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(within(section).getByRole('button', { name: '永久删除 收起的书' }))
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('p9'))
  })
})
