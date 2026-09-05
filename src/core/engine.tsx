import { useState, useEffect, Suspense, type FC, type ReactNode } from 'react'
import { PanelRight, Maximize2, Minimize2, Home, PanelLeftOpen, Sparkles } from 'lucide-react'
import { RichEditor, type RichEditorProps } from '../components/editor/RichEditor'
import { SettingsView } from '../components/settings/SettingsView'
import { DashboardView } from '../components/dashboard/DashboardView'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PluginSuspenseFallback } from './components/PluginSuspenseFallback'
import { IconButton, Row } from '../ui/atoms'

// 42 模块组件引入
import { TAB_DEFINITIONS as tabDefinitions, type TabDefinition } from '../config/tabDefinitions'
import { SidebarNav } from '../components/layout/SidebarNav'
import { useResizableWidth } from '../hooks/useResizableWidth'
import { FormView } from '../components/views/FormView'
import { TableView } from '../components/views/TableView'
import { CardView } from '../components/views/CardView'
import { GuideView } from '../components/views/GuideView'
import { InspireTools } from '../components/tools/InspireTools'
import { CheckTools } from '../components/tools/CheckTools'
import { MaterialLibrary } from '../components/tools/MaterialLibrary'
import { useOptionalPluginRegistry, ALL_AVAILABLE_PLUGINS } from './pluginRegistry'

interface EngineProps {
  projectId: string
  /** 项目名称由组合根（App）注入，外壳层不直接依赖 IndexedDB */
  projectName?: string
  /** 自定义右侧面板（例如 AI 副驾驶），传入时右侧信息栏显示该面板而非默认统计 */
  rightPanel?: ReactNode
  /** 右侧信息栏默认是否开启（默认关闭，保持正文写作画布宽敞；测试中可显式开启） */
  defaultRightOpen?: boolean
  /** 写作台工具栏中「打开 AI 副驾驶」的回调 */
  onOpenAssistant?: () => void
  /** Daemon 连接状态与重连（透传给编辑器状态栏） */
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
  /** 行内 Ghost Text 续写请求 */
  onRequestGhost?: (chapterId: string, text: string) => Promise<string | null>
  /** 发送指令给 AI 副驾驶（划词润色等） */
  onAiPrompt?: (text: string, chapterId?: string) => void
  /** 返回书架/工作台入口（提供时顶栏显示返回按钮） */
  onHome?: () => void
}

interface Stats {
  title?: string
  wordCount: number
  updatedAt?: number
}

// 视图注册表：以数据驱动替代 if 链，新增视图只需登记一条（OCP，§3.1）
interface ViewDeps {
  projectId: string
  activeTabId: string
  tabMeta?: TabDefinition
  onOpenView: (v: string) => void
  onStats: (s: Stats) => void
  onOpenAssistant?: () => void
  onStartFocus: () => void
  editorProps: RichEditorProps
}

type ViewFactory = (deps: ViewDeps) => ReactNode

const VIEW_REGISTRY: Record<string, ViewFactory> = {
  dashboard: ({ projectId, onOpenView, onStats, onOpenAssistant, onStartFocus }) => (
    <DashboardView
      projectId={projectId}
      onOpenView={onOpenView}
      onStats={onStats}
      onOpenAssistant={onOpenAssistant}
      onStartFocus={onStartFocus}
    />
  ),
  editor: ({ editorProps }) => <RichEditor {...editorProps} />,
  guide: ({ onOpenView }) => <GuideView onNavigate={(tId: string) => onOpenView(tId)} />,
  'inspire-tools': () => <InspireTools />,
  'check-tools': ({ projectId }) => <CheckTools projectId={projectId} />,
  'material-library': () => <MaterialLibrary />,
}

const TYPE_VIEW_REGISTRY: Partial<Record<TabDefinition['type'], ViewFactory>> = {
  form: ({ projectId, activeTabId, tabMeta }) => (
    <FormView projectId={projectId} tabId={activeTabId} tabMeta={tabMeta} />
  ),
  table: ({ projectId, activeTabId, tabMeta }) => (
    <TableView projectId={projectId} tabId={activeTabId} tabMeta={tabMeta} />
  ),
  card: ({ projectId, activeTabId, tabMeta }) => (
    <CardView projectId={projectId} tabId={activeTabId} tabMeta={tabMeta} />
  ),
}

export const Engine: FC<EngineProps> = ({
  projectId,
  projectName,
  rightPanel,
  defaultRightOpen = false,
  onOpenAssistant,
  isConnected,
  isReconnecting,
  onReconnect,
  onRequestGhost,
  onAiPrompt,
  onHome,
}) => {
  // 当前激活的页签（默认直达正文写作 editor）
  const [activeTabId, setActiveTabId] = useState<string>('editor')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(defaultRightOpen)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [isTypewriter, setIsTypewriter] = useState(false)
  const [stats, setStats] = useState<Stats>({ wordCount: 0 })

  // 右侧 AI 助手面板宽度可调：默认 340px，最小 260px，最大 520px，方向 right（向左拖加宽）
  const {
    width: rightWidth,
    isDragging: isRightDragging,
    onMouseDown: onRightMouseDown,
    resetWidth: resetRightWidth,
  } = useResizableWidth({
    initialWidth: 340,
    minWidth: 260,
    maxWidth: 520,
    storageKey: 'inkpi-right-panel-width',
    direction: 'right',
  })

  // 聚焦模式：Esc 退出
  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const pluginCtx = useOptionalPluginRegistry()
  const activePlugins = pluginCtx?.activePlugins ?? ALL_AVAILABLE_PLUGINS
  const matchingPlugin = activePlugins.find((p) => p.id === activeTabId)

  const activeTabMeta = tabDefinitions.find((t) => t.id === activeTabId)
  const viewTitle =
    activeTabId === 'editor'
      ? '正文写作'
      : activeTabId === 'dashboard'
        ? '写作工作台全景'
        : matchingPlugin
          ? matchingPlugin.name
          : activeTabMeta?.name || '工作台'

  const isEditor = activeTabId === 'editor'

  const editorProps: RichEditorProps = {
    projectId,
    isTypewriter,
    onTypewriterChange: setIsTypewriter,
    focusMode,
    onStats: setStats,
    onOpenAssistant,
    isConnected,
    isReconnecting,
    onReconnect,
    onRequestGhost,
    onAiPrompt,
    onHome,
    onToggleFocus: () => setFocusMode((f) => !f),
    isFullscreen,
    onToggleFullscreen: () => setIsFullscreen((f) => !f),
    onToggleRightPanel: () => {
      if (onOpenAssistant) onOpenAssistant()
      setRightOpen((o) => !o)
    },
    isRightOpen: rightOpen,
    hasAssistant: Boolean(onOpenAssistant),
    isNavOpen: leftOpen,
    onToggleNav: () => setLeftOpen((o) => !o),
  }

  // 视图渲染分发：以注册表替代 if 链（OCP，§3.1）
  const resolveCurrentView = () => {
    const deps: ViewDeps = {
      projectId,
      activeTabId,
      tabMeta: activeTabMeta,
      onOpenView: (v) => setActiveTabId(v),
      onStats: setStats,
      onOpenAssistant,
      onStartFocus: () => {
        setActiveTabId('editor')
        setFocusMode(true)
      },
      editorProps,
    }

    const explicit = VIEW_REGISTRY[activeTabId]
    if (explicit) return explicit(deps)

    if (matchingPlugin) {
      const MainView = matchingPlugin.mainView
      return (
        <Suspense fallback={<PluginSuspenseFallback label={`${matchingPlugin.name} 加载中...`} />}>
          <MainView projectId={projectId} onStats={setStats} />
        </Suspense>
      )
    }

    if (!activeTabMeta) {
      return (
        <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
          页签不存在或正在建设中
        </div>
      )
    }

    const byType = TYPE_VIEW_REGISTRY[activeTabMeta.type]
    if (byType) return byType(deps)

    return (
      <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
        【{activeTabMeta.name}】模块已连接至数据中心。
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--ink-bg)] text-[var(--ink-text)]">
      {/* 42 模块与全景侧边栏 */}
      {!isFullscreen && !focusMode && leftOpen && (
        <SidebarNav
          activeTabId={activeTabId}
          onSelectTab={(tabId) => setActiveTabId(tabId)}
          projectName={projectName || ''}
          onBackToHome={onHome}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setLeftOpen(false)}
        />
      )}

      {/* 主区 */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* 顶栏：非写作模式下呈现（正文写作已通过 EditorToolbar 实现单层全能合一，避免纵向双顶栏叠罗汉） */}
        {!isEditor && (
          <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-[var(--ink-border)]">
            <div className="flex items-center gap-1 min-w-0">
              {/* 侧边栏展开图标（收起时紧贴小房子图标旁边，完全不占独立侧栏列宽） */}
              {!isFullscreen && !focusMode && !leftOpen && (
                <IconButton onClick={() => setLeftOpen(true)} title="展开导航">
                  <PanelLeftOpen className="w-4 h-4" />
                </IconButton>
              )}
              {onHome && (
                <IconButton onClick={onHome} title="返回作品库">
                  <Home className="w-4 h-4" />
                </IconButton>
              )}
              <span className="text-[13px] font-medium truncate">{viewTitle}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <IconButton onClick={() => setIsFullscreen((f) => !f)} title="全屏 / 退出全屏">
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </IconButton>
              {onOpenAssistant ? (
                <IconButton
                  onClick={() => {
                    onOpenAssistant()
                    setRightOpen((o) => !o)
                  }}
                  title={rightOpen ? '收起 AI 助手' : '打开 AI 助手'}
                  className={rightOpen ? 'text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]' : ''}
                >
                  <Sparkles className="w-4 h-4" />
                </IconButton>
              ) : (
                <IconButton
                  onClick={() => setRightOpen((o) => !o)}
                  title={rightOpen ? '收起信息栏' : '展开信息栏'}
                  className={rightOpen ? 'text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]' : ''}
                >
                  <PanelRight className="w-4 h-4" />
                </IconButton>
              )}
            </div>
          </header>
        )}

        {/* 内容分发：按视图类型挂载不同容器 */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0" key={activeTabId}>
            <ErrorBoundary label={viewTitle}>{resolveCurrentView()}</ErrorBoundary>
          </div>

          {/* 右侧面板：展开且非全屏/非聚焦时呈现（优先展示 AI 对话助手） */}
          {rightOpen &&
            !isFullscreen &&
            !focusMode &&
            (rightPanel ? (
              <aside
                style={{ width: `${rightWidth}px` }}
                className="shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] overflow-y-auto relative group"
              >
                {/* 拖拽手柄：左侧边线，向左拉加宽，带悬浮光标与最小宽度保护 */}
                <div
                  onMouseDown={onRightMouseDown}
                  onDoubleClick={resetRightWidth}
                  title="拖拽调整面板宽度（双击恢复默认）"
                  className={`absolute top-0 left-[-3px] w-[6px] h-full cursor-col-resize z-30 transition-colors ${
                    isRightDragging
                      ? 'bg-[var(--ink-accent)] w-[3px]'
                      : 'hover:bg-[var(--ink-accent)]/50'
                  }`}
                />
                <div className="h-full">{rightPanel}</div>
              </aside>
            ) : !onOpenAssistant ? (
              <aside className="shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] overflow-y-auto w-[220px]">
                <div className="p-3 space-y-3 text-[12px]">
                  <div className="text-[11px] font-medium text-[var(--ink-text-faint)]">
                    文档信息
                  </div>
                  <Row label="当前章节" value={stats.title || '—'} />
                  <Row label="正文字数" value={`${stats.wordCount} 字`} />
                  <Row
                    label="最后更新"
                    value={
                      stats.updatedAt
                        ? new Date(stats.updatedAt).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '—'
                    }
                  />
                  <div className="pt-2 border-t border-[var(--ink-border)] text-[11px] leading-relaxed text-[var(--ink-text-faint)]">
                    快捷键：⌘S 保存 · ⌘B 折叠目录 · ⌘\ 全屏
                  </div>
                </div>
              </aside>
            ) : null)}
        </div>
      </main>

      {/* 聚焦模式浮动退出按钮 */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-full bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[12px] text-[var(--ink-text-muted)] shadow-[var(--ink-shadow)] hover:text-[var(--ink-text)] flex items-center gap-1.5 transition-colors"
        >
          <Minimize2 className="w-3.5 h-3.5" /> 退出聚焦 (Esc)
        </button>
      )}

      <SettingsView open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
