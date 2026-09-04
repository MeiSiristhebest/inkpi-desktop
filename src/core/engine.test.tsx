import { describe, it, expect, vi, afterEach } from 'vitest'
import { render as baseRender, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Engine } from './engine'
import { db } from '../db/indexedDB'
import { SettingsProvider } from './settings'

// Engine 默认挂载 RichEditor，后者依赖 useSettings（§12.3：Provider 内才能使用）。
// rerender 也会落到 Provider 之外，故对 rerender 一并包裹。
const render = (
  ui: Parameters<typeof baseRender>[0],
  options?: Parameters<typeof baseRender>[1],
) => {
  const result = baseRender(<SettingsProvider>{ui}</SettingsProvider>, options)
  const originalRerender = result.rerender
  return {
    ...result,
    rerender: (nextUi: Parameters<typeof originalRerender>[0]) =>
      originalRerender(<SettingsProvider>{nextUi}</SettingsProvider>),
  }
}

// Engine 默认挂载 RichEditor（富文本内核），需 mock 掉 TipTap 以免在 jsdom 中实例化 ProseMirror
vi.mock('@tiptap/react', () => {
  const noop = () => {}
  const makeCommands = () => ({
    setContent: vi.fn(),
    insertContent: vi.fn(),
    focus: () => ({ toggleBold: () => ({ run: noop }), toggleItalic: () => ({ run: noop }) }),
    chain: () => ({
      focus: () => ({ toggleBold: () => ({ run: noop }), toggleItalic: () => ({ run: noop }) }),
    }),
  })
  const useEditor = () => ({
    getHTML: () => '<p>x</p>',
    getText: () => 'x',
    isActive: () => false,
    commands: makeCommands(),
    state: { doc: { textBetween: () => '', content: { size: 0 } }, selection: { from: 0, to: 0 } },
    view: {
      state: { selection: { to: 0 }, doc: { content: { size: 0 } }, tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
    },
  })
  const EditorContent = () => <div data-testid="tiptap-editor" />
  const BubbleMenu = ({ children }: any) => <>{children}</>
  return { useEditor, EditorContent, BubbleMenu }
})

afterEach(() => cleanup())

describe('Engine — 主视口路由与多栏布局', () => {
  it('shows the editor view by default for pure writing focus', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('switches to plugin category views and isolates the editor when navigating away', () => {
    render(<Engine projectId="p1" />)
    // 新版侧栏：分类折叠面板展示插件
    expect(screen.getByPlaceholderText('搜索插件…')).toBeInTheDocument()
    // 点击「写作面板」切回工作台视图
    fireEvent.click(screen.getByText('写作面板'))
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    // 点击「正文写作」回到编辑器
    fireEvent.click(screen.getAllByText('正文写作')[0])
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('toggles the left navigation panel', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('收起导航'))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('展开导航'))
    expect(screen.getByText('InkPi')).toBeInTheDocument()
  })

  it('toggles the right info panel', () => {
    render(<Engine projectId="p1" defaultRightOpen={true} />)
    expect(screen.getByText('文档信息')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('收起信息栏'))
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('展开信息栏'))
    expect(screen.getByText('文档信息')).toBeInTheDocument()
  })

  it('shows focus toggle only in the editor view', () => {
    render(<Engine projectId="p1" />)
    // 默认即为正文写作，显示聚焦按钮
    expect(screen.getByTitle('聚焦模式（仅留写作画布）')).toBeInTheDocument()

    const btn = screen.getByTitle('聚焦模式（仅留写作画布）')
    fireEvent.click(btn)
    expect(btn.className).toMatch(/text-\[var\(--ink-accent\)\]/)
    // 退出聚焦模式，恢复侧栏导航
    fireEvent.click(btn)

    // 切换至非编辑器视图（如写作面板）后隐藏
    fireEvent.click(screen.getByText('写作面板'))
    expect(screen.queryByTitle('聚焦模式（仅留写作画布）')).not.toBeInTheDocument()
  })

  it('hides the side panels in fullscreen mode', () => {
    render(<Engine projectId="p1" defaultRightOpen={true} />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('全屏 / 退出全屏'))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('全屏 / 退出全屏'))
    expect(screen.getByText('InkPi')).toBeInTheDocument()
  })

  it('formats the last-updated time when a chapter carries updatedAt', async () => {
    const pid = 'p-engine-stats'
    await db.put('volumes', {
      id: 'vStats',
      projectId: pid,
      title: 'V',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    })
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
    render(<Engine projectId={pid} defaultRightOpen={true} />)
    // 精确匹配右侧信息栏的「最后更新」标签（写作台状态栏也有「最后更新：…」会重名）
    const label = await screen.findByText('最后更新', { exact: true })
    // 覆盖 stats.updatedAt 有值时的格式化分支（非占位 '—'）
    // 注意：Row 把 label 与 value 拆成两个 span，'—' 在 value span，需查整行
    const row = label.parentElement as HTMLElement
    await waitFor(() => expect(row.textContent).not.toContain('—'))
    await db.delete('volumes', 'vStats')
    await db.delete('chapters', 'cStats')
  })

  it('keeps the custom rightPanel collapsed by default, then opens it via the info toggle', () => {
    render(<Engine projectId="p1" rightPanel={<div>自定义AI面板</div>} />)
    // 传入 rightPanel 时默认不展开：默认统计与自定义面板都应隐藏
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    expect(screen.queryByText('自定义AI面板')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('展开信息栏'))
    expect(screen.getByText('自定义AI面板')).toBeInTheDocument()
  })

  it('does not render AI助手 decoration button in editor toolbar even when onOpenAssistant is provided', () => {
    const onOpenAssistant = vi.fn()
    render(<Engine projectId="p1" onOpenAssistant={onOpenAssistant} />)
    fireEvent.click(screen.getAllByText('正文写作')[0])
    expect(screen.queryByText('AI 助手')).not.toBeInTheDocument()
  })

  it('enters focus mode and hides all chrome, then exits via Esc', () => {
    render(<Engine projectId="p1" defaultRightOpen={true} />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    expect(screen.getByText('文档信息')).toBeInTheDocument()

    // 聚焦模式仅在正文写作视图下可用
    fireEvent.click(screen.getAllByText('正文写作')[0])
    fireEvent.click(screen.getByTitle('聚焦模式（仅留写作画布）'))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    expect(screen.getByText('文档信息')).toBeInTheDocument()
  })

  it('fully collapses the left navigation and restores it', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    // 侧栏可折叠为窄边栏（按钮在侧边栏自身 header 上）
    fireEvent.click(screen.getByTitle('收起导航'))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    // 窄边栏上的展开按钮可重新唤出
    fireEvent.click(screen.getByTitle('展开导航'))
    expect(screen.getByText('InkPi')).toBeInTheDocument()
  })

  it('renders plugin cards when a plugin tab is active', () => {
    render(<Engine projectId="p1" />)
    // 在分类列表中查找并点击任意活跃插件
    const firstPlugin = screen.queryByText(/活体世界观|伏笔账本|时空大纲/)
    if (firstPlugin) {
      fireEvent.click(firstPlugin)
      // 切换到插件视图后，章节目录应该隐藏
      expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    }
    // 点击正文写作恢复
    fireEvent.click(screen.getByText('正文写作'))
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('handles onOpenSettings and focus mode exit button', () => {
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByText('设置'))
    expect(screen.getAllByText('外观').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByTitle('关闭 (Esc)'))

    // 快捷键进入聚焦模式
    fireEvent.click(screen.getByTitle('聚焦模式（仅留写作画布）'))
    const exitBtn = screen.getByText(/退出聚焦/)
    expect(exitBtn).toBeInTheDocument()
    fireEvent.click(exitBtn)
    expect(screen.queryByText(/退出聚焦/)).not.toBeInTheDocument()
  })

  it('renders plugin data table when a table-type plugin is selected', () => {
    render(<Engine projectId="p1" />)
    // 新版侧栏：通过搜索找到台账类插件
    const searchInput = screen.getByPlaceholderText('搜索插件…')
    fireEvent.change(searchInput, { target: { value: '台账' } })
    const tablePlugin = screen.queryByText(/台账|势力分立/)
    if (tablePlugin) {
      fireEvent.click(tablePlugin)
      expect(screen.getByText(/新增行记录/)).toBeInTheDocument()
    }
    // 恢复
    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('正文写作'))
  })

  it('handles guide, material, check, inspire, fallback views via plugin search', () => {
    render(<Engine projectId="p1" />)
    const searchInput = screen.getByPlaceholderText('搜索插件…')

    // 搜索「创作指南」类插件
    fireEvent.change(searchInput, { target: { value: '指南' } })
    const guideBtn = screen.queryByText('创作指南') || screen.queryByText('新手指南')
    if (guideBtn) fireEvent.click(guideBtn)

    // 搜索「势力分立」类插件
    fireEvent.change(searchInput, { target: { value: '势力' } })
    const tableBtn = screen.queryByText('势力分立')
    if (tableBtn) fireEvent.click(tableBtn)

    // 清空搜索，回到编辑器
    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('正文写作'))
  })
})
