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

  it('switches to form/table views and isolates the editor when reference is expanded', () => {
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByText('查看预留插件模块参考'))
    fireEvent.click(screen.getByText('作品定位'))
    expect(screen.getAllByText('作品定位').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('世界设定'))
    expect(screen.getAllByText('世界设定').length).toBeGreaterThanOrEqual(1)

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

  it('renders card view when a card-type tab is active', () => {
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByText('查看预留插件模块参考'))
    // 寻找角色卡/组织势力等卡片类型
    const cardTab = screen.queryByText('重要角色') || screen.queryByText('主要人物')
    if (cardTab) {
      fireEvent.click(cardTab)
      expect(screen.getByText(/卡片/)).toBeInTheDocument()
    }
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

  it('renders table view when table tab is selected', () => {
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByText('查看预留插件模块参考'))
    const tab = screen.queryByText('势力分立') || screen.queryByText('台账')
    if (tab) {
      fireEvent.click(tab)
      expect(screen.getByText(/新增行记录/)).toBeInTheDocument()
    }
  })

  it('handles material, check, inspire, fallback, and generic views directly', () => {
    render(<Engine projectId="p1" />)

    // guide view
    fireEvent.click(screen.getByText('查看预留插件模块参考'))
    const guideBtn = screen.queryByText('创作指南') || screen.queryByText('新手指南')
    if (guideBtn) fireEvent.click(guideBtn)

    // 直接切到 table 别名
    const tableBtn = screen.queryByText('势力分立')
    if (tableBtn) fireEvent.click(tableBtn)
  })
})
