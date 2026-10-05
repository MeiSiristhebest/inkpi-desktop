import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorToolbar } from './EditorToolbar'
import type { EditorModel } from '../hooks/useChapterEditorModel'

const { useOptionalPluginRegistry, useOptionalPluginHostContext } = vi.hoisted(() => ({
  useOptionalPluginRegistry: vi.fn(),
  useOptionalPluginHostContext: vi.fn(),
}))

// 抽屉分组用的是能力注册表里的三类，所以 capabilityRegistry 保持真实实现。
vi.mock('../../../core/pluginRegistry', () => ({ useOptionalPluginRegistry }))
vi.mock('../../../core/pluginHostContext', () => ({ useOptionalPluginHostContext }))

const View = () => <div>view</div>
const DrawerView = () => <div>drawer</div>
const Icon = () => null

const codexPlugin = {
  id: 'living-codex',
  name: '活体世界书',
  description: '人物、地点与设定的实时随动档案',
  version: '1.0.0',
  category: 'lore',
  icon: Icon,
  mainView: View,
  drawerSnippetView: DrawerView,
  drawerCapability: 'context-inspector',
}

const linterPlugin = {
  id: 'narrative-linter',
  name: '叙事体检',
  description: '口癖、重复句式与节奏问题清单',
  version: '1.0.0',
  category: 'review',
  icon: Icon,
  mainView: View,
  drawerSnippetView: DrawerView,
  drawerCapability: 'live-diagnostic',
}

// 与 linterPlugin 同一套件（review）：只有按能力分类才会跟它分成两组。
const forgePlugin = {
  id: 'name-forge',
  name: '起名姬',
  description: '人物、门派与地名候选',
  version: '1.0.0',
  category: 'review',
  icon: Icon,
  mainView: View,
  drawerSnippetView: DrawerView,
  drawerCapability: 'quick-action',
}

// 有抽屉但没归类：不进候选，也不给它编一个分组名（§P2.8 要求作者明确选一类）。
const unclassifiedPlugin = {
  id: 'legacy-drawer',
  name: '未归类抽屉',
  description: '历史遗留',
  version: '1.0.0',
  category: 'review',
  icon: Icon,
  mainView: View,
  drawerSnippetView: DrawerView,
}

// 没有抽屉的插件：绝不能成为 Puzzle 按钮的兜底目标
const chartPlugin = {
  id: 'rhythm-chart',
  name: '节奏图表',
  description: '节奏统计',
  version: '1.0.0',
  category: 'review',
  icon: Icon,
  mainView: View,
}

const model = {
  actions: new Proxy({}, { get: () => vi.fn() }),
  currentChapterIndex: 0,
  linearChapters: [{ id: 'c1', title: '第一章' }],
  isSidebarOpen: true,
  breadcrumb: '第一卷 · 第一章',
  activeChapter: { id: 'c1', title: '第一章', status: 'draft', wordCount: 1200 },
  showSplitView: false,
  showScratchpad: false,
  showFindReplace: false,
  ghostText: '',
} as unknown as EditorModel

function mockRegistry(activePlugins: unknown[]) {
  useOptionalPluginRegistry.mockReturnValue({ activePlugins } as never)
}

function mockHost(activeDrawerPluginId: string | null) {
  const host = {
    activeDrawerPluginId,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
  }
  useOptionalPluginHostContext.mockReturnValue(host as never)
  return host
}

function trigger() {
  return screen.getByTestId('editor-toolbar-drawer-trigger')
}

/** 菜单里实际渲染出来的分组小标题，顺序即作者看到的分组顺序。 */
function groupLabels(): string[] {
  return screen
    .getAllByTestId('context-menu-group-label')
    .map((node) => node.textContent ?? '')
    .filter(Boolean)
}

/** Puzzle 按钮位于工具栏右端的「工作台功能」组里，该组只在有聚焦/全屏/右栏回调时渲染。 */
function renderToolbar() {
  return render(
    <EditorToolbar model={model} onToggleFocus={() => {}} onToggleRightPanel={() => {}} />,
  )
}

describe('EditorToolbar 插件抽屉选择器（P2.8）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegistry([chartPlugin, codexPlugin, linterPlugin, forgePlugin, unclassifiedPlugin])
  })

  it('点击 Puzzle 只摊开候选，不再打开「第一个有抽屉的插件」', () => {
    const host = mockHost(null)
    renderToolbar()

    fireEvent.click(trigger())

    expect(host.openDrawer).not.toHaveBeenCalled()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('活体世界书')
    expect(items[1]).toHaveTextContent('起名姬')
    expect(items[2]).toHaveTextContent('叙事体检')
    // 起名姬与叙事体检同属 review 套件，注册表顺序也是体检在前：
    // 候选仍按三类能力重排，说明分组的依据是能力，不是插件套件，也不是注册表顺序。
    expect(groupLabels()).toEqual(['上下文检视', '快捷动作', '实时诊断'])
    // 没归类的抽屉不得混进候选
    expect(screen.queryByText('未归类抽屉')).not.toBeInTheDocument()
  })

  it('条目会说明这个抽屉是什么，选择由作者做出', () => {
    mockHost(null)
    renderToolbar()
    fireEvent.click(trigger())

    expect(screen.getByText('人物、地点与设定的实时随动档案')).toBeInTheDocument()
    expect(screen.getByText('口癖、重复句式与节奏问题清单')).toBeInTheDocument()
  })

  it('没有归入三类能力的抽屉不进候选', () => {
    // 注册表要求抽屉与能力类别成对声明，所以这不是在猜它属于哪一类，
    // 而是不给一个没有归类的抽屉编出分组标题（INV-09：展示出去的话必须真成立）。
    mockHost(null)
    mockRegistry([unclassifiedPlugin, codexPlugin])
    renderToolbar()
    fireEvent.click(trigger())

    expect(screen.queryByText('未归类抽屉')).not.toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
    expect(groupLabels()).toEqual(['上下文检视'])
  })

  it('选中某个条目才打开那个插件的抽屉，且菜单收起', () => {
    const host = mockHost(null)
    renderToolbar()
    fireEvent.click(trigger())

    fireEvent.click(screen.getByRole('menuitem', { name: /叙事体检/ }))

    expect(host.openDrawer).toHaveBeenCalledTimes(1)
    expect(host.openDrawer).toHaveBeenCalledWith('narrative-linter')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('已经开着抽屉时，关闭是显式条目而不是按钮的隐式二态', () => {
    const host = mockHost('narrative-linter')
    renderToolbar()
    fireEvent.click(trigger())

    fireEvent.click(screen.getByRole('menuitem', { name: /^关闭/ }))

    expect(host.closeDrawer).toHaveBeenCalledTimes(1)
    expect(host.openDrawer).not.toHaveBeenCalled()
  })

  it('开着抽屉时也能直接改选另一个插件', () => {
    const host = mockHost('narrative-linter')
    renderToolbar()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: /活体世界书/ }))

    expect(host.openDrawer).toHaveBeenCalledWith('living-codex')
    expect(host.closeDrawer).not.toHaveBeenCalled()
  })

  it('没有启用中的抽屉插件时，如实说明而不是静默无事发生', () => {
    const host = mockHost(null)
    mockRegistry([chartPlugin])
    renderToolbar()

    fireEvent.click(trigger())

    expect(
      screen.getByText('没有启用中的插件提供随动抽屉，请先在「插件管理」里启用'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(host.openDrawer).not.toHaveBeenCalled()
    expect(host.closeDrawer).not.toHaveBeenCalled()
  })

  it('键盘可以走完这份候选：方向键移动、回车确认', () => {
    const host = mockHost(null)
    renderToolbar()
    fireEvent.click(trigger())

    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(items[1], { key: 'Enter' })
    expect(host.openDrawer).toHaveBeenCalledWith('name-forge')
  })
})
