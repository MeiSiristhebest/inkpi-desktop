import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  render as baseRender,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react'
import { Engine } from './engine'
import { projectEnabledPluginIds } from './defaultCommands'
import { db } from '../db/indexedDB'
import { SettingsProvider } from './settings'
import { lastActiveChapterKey } from '../lib/resumePointer'

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
vi.mock('@tiptap/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
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
    on: vi.fn(),
    off: vi.fn(),
    commands: makeCommands(),
    state: { doc: { textBetween: () => '', content: { size: 0 } }, selection: { from: 0, to: 0 } },
    view: {
      state: { selection: { to: 0 }, doc: { content: { size: 0 } }, tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
    },
  })
  const EditorContent = () => <div data-testid="tiptap-editor" />
  const BubbleMenu = ({ children }: any) => <>{children}</>
  return { ...actual, useEditor, EditorContent, BubbleMenu }
})

const defaultViewportWidth = window.innerWidth

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

beforeEach(() => {
  setViewportWidth(1440)
  projectEnabledPluginIds(null)
})

afterEach(() => {
  cleanup()
  projectEnabledPluginIds(null)
  setViewportWidth(defaultViewportWidth)
})

describe('Engine — 主视口路由与多栏布局', () => {
  it('shows the editor view by default for pure writing focus', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('opens the exact chapter selected from the dashboard instead of the saved resume chapter', async () => {
    const projectId = 'p-dashboard-chapter-target'
    const volume = {
      id: 'v-dashboard-chapter-target',
      projectId,
      title: '第一卷',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    }
    const resumeChapter = {
      id: 'c-dashboard-resume',
      projectId,
      volumeId: volume.id,
      title: '第001章 上次章节',
      content: '<p>主角在上次章节</p>',
      wordCount: 8,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    }
    const targetChapter = {
      id: 'c-dashboard-target',
      projectId,
      volumeId: volume.id,
      title: '第002章 热图目标',
      content: '<p>主角在目标章节</p>',
      wordCount: 8,
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    const characterCard = {
      id: 'card-dashboard-character',
      projectId,
      tabId: 'char-main',
      name: '主角',
      data: {},
      createdAt: 1,
      updatedAt: 1,
    }
    const resumeKey = lastActiveChapterKey(projectId)

    await db.put('volumes', volume)
    await db.put('chapters', resumeChapter)
    await db.put('chapters', targetChapter)
    await db.put('cardRecords', characterCard)
    localStorage.setItem(resumeKey, resumeChapter.id)

    try {
      render(<Engine projectId={projectId} />)
      expect(await screen.findByDisplayValue(resumeChapter.title)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '打开写作面板' }))
      fireEvent.click(
        await screen.findByRole('button', {
          name: `在《${targetChapter.title}》中查看主角的出场位置`,
        }),
      )
      expect(await screen.findByDisplayValue(targetChapter.title)).toBeInTheDocument()
      await waitFor(() => expect(localStorage.getItem(resumeKey)).toBe(targetChapter.id))

      fireEvent.click(screen.getByRole('button', { name: '打开写作面板' }))
      fireEvent.click(
        await screen.findByRole('button', { name: `打开《${resumeChapter.title}》正文` }),
      )
      expect(await screen.findByDisplayValue(resumeChapter.title)).toBeInTheDocument()
      await waitFor(() => expect(localStorage.getItem(resumeKey)).toBe(resumeChapter.id))
    } finally {
      cleanup()
      localStorage.removeItem(resumeKey)
      await db.delete('cardRecords', characterCard.id)
      await db.delete('chapters', resumeChapter.id)
      await db.delete('chapters', targetChapter.id)
      await db.delete('volumes', volume.id)
    }
  })

  it('opens an enabled plugin from the command palette and returns to the editor', async () => {
    projectEnabledPluginIds(new Set(['living-codex']))
    render(<Engine projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: '搜索命令与插件' }))
    const searchInput = screen.getByRole('textbox', { name: '搜索命令' })
    fireEvent.change(searchInput, { target: { value: '活体世界观' } })
    fireEvent.click(screen.getByTestId('command-item-cmd-capability-living-codex'))

    expect(await screen.findByText('活体世界观')).toBeInTheDocument()
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '搜索命令与插件' }))
    const returnSearch = screen.getByRole('textbox', { name: '搜索命令' })
    fireEvent.change(returnSearch, { target: { value: '正文编辑器' } })
    fireEvent.click(screen.getByTestId('command-item-cmd-nav-editor'))
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('toggles the left navigation panel', () => {
    render(<Engine projectId="p1" />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收起导航' }))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sidebar-nav-compact-toggle'))
    expect(screen.getByText('InkPi')).toBeInTheDocument()
  })

  it('keeps one compact navigation toggle when the left panel is collapsed', () => {
    render(<Engine projectId="p1" />)
    expect(screen.queryByTestId('sidebar-nav-compact-toggle')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收起导航' }))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    const compactToggle = screen.getByTestId('sidebar-nav-compact-toggle')
    expect(compactToggle).toHaveAttribute('aria-label', '展开导航')

    fireEvent.click(compactToggle)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-nav-compact-toggle')).not.toBeInTheDocument()
  })

  it('auto-collapses the global navigation to one out-of-flow toggle in a compact viewport', () => {
    render(<Engine projectId="p1" />)
    const root = screen.getByTestId('project-engine-root')
    expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument()

    act(() => {
      setViewportWidth(1000)
      window.dispatchEvent(new Event('resize'))
    })

    expect(root).toHaveAttribute('data-nav-open', 'false')
    expect(root.querySelector('[data-testid="sidebar-nav"]')).not.toBeInTheDocument()
    const compactToggle = screen.getByTestId('sidebar-nav-compact-toggle')
    expect(compactToggle).toHaveAttribute('data-layout', 'compact-nav-toggle')
    expect(compactToggle.parentElement).toBe(root)

    fireEvent.click(compactToggle)
    expect(root).toHaveAttribute('data-nav-open', 'true')
    expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument()

    act(() => {
      setViewportWidth(1440)
      window.dispatchEvent(new Event('resize'))
    })
    expect(root).toHaveAttribute('data-nav-open', 'true')
    expect(screen.queryByTestId('sidebar-nav-compact-toggle')).not.toBeInTheDocument()
  })

  it('toggles the right info panel', () => {
    render(<Engine projectId="p1" defaultRightOpen={true} />)
    expect(screen.getByText('文档信息')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收起信息栏' }))
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开信息栏' }))
    expect(screen.getByText('文档信息')).toBeInTheDocument()
  })

  it('shows focus toggle only in the editor view', () => {
    render(<Engine projectId="p1" />)
    // 默认即为正文写作，显示聚焦按钮
    expect(screen.getByRole('button', { name: '聚焦模式（仅留写作画布）' })).toBeInTheDocument()

    const btn = screen.getByRole('button', { name: '聚焦模式（仅留写作画布）' })
    fireEvent.click(btn)
    expect(btn.className).toMatch(/text-\[var\(--ink-accent\)\]/)
    // 退出聚焦模式，恢复侧栏导航
    fireEvent.click(btn)

    // 切换至非编辑器视图（如写作面板）后隐藏
    fireEvent.click(screen.getByRole('button', { name: '打开写作面板' }))
    expect(
      screen.queryByRole('button', { name: '聚焦模式（仅留写作画布）' }),
    ).not.toBeInTheDocument()
  })

  it('hides the side panels in fullscreen mode', () => {
    render(<Engine projectId="p1" defaultRightOpen={true} />)
    expect(screen.getByText('InkPi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '全屏 / 退出全屏' }))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    expect(screen.queryByText('文档信息')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-nav-compact-toggle')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '全屏 / 退出全屏' }))
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

    fireEvent.click(screen.getByRole('button', { name: '展开信息栏' }))
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
    fireEvent.click(screen.getByRole('button', { name: '聚焦模式（仅留写作画布）' }))
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
    fireEvent.click(screen.getByRole('button', { name: '收起导航' }))
    expect(screen.queryByText('InkPi')).not.toBeInTheDocument()
    // 窄边栏上的展开按钮可重新唤出
    fireEvent.click(screen.getByTestId('sidebar-nav-compact-toggle'))
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
    fireEvent.click(screen.getByRole('button', { name: '关闭 (Esc)' }))

    // 快捷键进入聚焦模式
    fireEvent.click(screen.getByRole('button', { name: '聚焦模式（仅留写作画布）' }))
    const exitBtn = screen.getByText(/退出聚焦/)
    expect(exitBtn).toBeInTheDocument()
    fireEvent.click(exitBtn)
    expect(screen.queryByText(/退出聚焦/)).not.toBeInTheDocument()
  })

  it('renders the faction table after selecting its enabled command', async () => {
    projectEnabledPluginIds(new Set(['faction-matrix']))
    render(<Engine projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: '搜索命令与插件' }))
    const searchInput = screen.getByRole('textbox', { name: '搜索命令' })
    fireEvent.change(searchInput, { target: { value: '势力外交盘' } })
    fireEvent.click(screen.getByTestId('command-item-cmd-capability-faction-matrix'))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('filters plugin commands by the enabled-plugin projection', () => {
    projectEnabledPluginIds(new Set(['living-codex']))
    render(<Engine projectId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: '搜索命令与插件' }))
    const searchInput = screen.getByRole('textbox', { name: '搜索命令' })

    fireEvent.change(searchInput, { target: { value: '活体世界观' } })
    expect(screen.getByTestId('command-item-cmd-capability-living-codex')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '势力外交盘' } })
    expect(
      screen.queryByTestId('command-item-cmd-capability-faction-matrix'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('未找到匹配的命令或能力')).toBeInTheDocument()
  })

  it('renders custom inspector and supports closing it via callback', () => {
    let closed = false
    render(
      <Engine
        projectId="p1"
        defaultRightOpen
        renderInspector={(state, onClose) => (
          <div data-testid="custom-inspector">
            <span>{state.surface}</span>
            <button
              onClick={() => {
                closed = true
                onClose()
              }}
            >
              关闭检查器
            </button>
          </div>
        )}
      />,
    )

    expect(screen.getByTestId('custom-inspector')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭检查器' }))
    expect(closed).toBe(true)
  })
})
