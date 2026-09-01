import { useState, type FC, type ComponentType, type ReactNode } from 'react'
import {
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  Type as TypeIcon,
  X,
  BookOpen,
  FileText,
  Table2,
} from 'lucide-react'
import { WriterDesk } from '../components/editor/WriterDesk'
import { LivingCodexPlugin } from '../plugins/living-codex'
import type { DesktopPlugin } from '../types/plugin'

// 主视口路由与容器分发 + 多栏工作区布局管理
//   - 当侧边栏选择「正文写作」(type === 'editor') 时，挂载写作台组件。
//   - 动态挂载已安装的业务插件 (如 LivingCodexPlugin 活体世界观图谱)。

type ViewType = 'editor' | 'form' | 'table' | string

interface EngineProps {
  projectId: string
  onBack?: () => void
  /** 自定义右侧面板（例如 AI 副驾驶），传入时右侧信息栏显示该面板而非默认统计 */
  rightPanel?: ReactNode
  /** 写作台工具栏中「打开 AI 副驾驶」的回调 */
  onOpenAssistant?: () => void
}

interface Stats {
  title?: string
  wordCount: number
  updatedAt?: number
}

const iconBtn =
  'p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150'

// 桌面端已安装插件注册表
export const INSTALLED_PLUGINS: DesktopPlugin[] = [
  LivingCodexPlugin,
]

const BUILTIN_NAV: { type: ViewType; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { type: 'editor', label: '正文写作', icon: BookOpen },
  { type: 'form', label: '表单视图', icon: FileText },
  { type: 'table', label: '表格视图', icon: Table2 },
]

export const Engine: FC<EngineProps> = ({ projectId, onBack, rightPanel, onOpenAssistant }) => {
  const [view, setView] = useState<ViewType>('editor')
  const [leftOpen, setLeftOpen] = useState(true)
  // 传入自定义右侧面板时，默认先收起，避免一打开就挤占写作区
  const [rightOpen, setRightOpen] = useState(rightPanel ? false : true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTypewriter, setIsTypewriter] = useState(false)
  const [stats, setStats] = useState<Stats>({ wordCount: 0 })

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--ink-bg)] text-[var(--ink-text)]">
      {/* 左侧导航：视图分发 */}
      {leftOpen && !isFullscreen && (
        <aside className="w-[180px] shrink-0 border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col">
          <div className="h-11 flex items-center gap-2 px-3 border-b border-[var(--ink-border)]">
            <span className="w-[22px] h-[22px] rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center text-[11px]">
              墨
            </span>
            <span className="text-[13px] font-medium truncate">工作台</span>
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {/* 内置视图 */}
            {BUILTIN_NAV.map((item) => {
              const Icon = item.icon
              const active = view === item.type
              return (
                <button
                  key={item.type}
                  onClick={() => setView(item.type)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--ink-bg-active)] font-medium'
                      : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}

            {/* 插件扩展入口 */}
            {INSTALLED_PLUGINS.length > 0 && (
              <div className="pt-3 pb-1 px-2 text-[10px] text-[var(--ink-text-faint)] font-medium">
                业务插件
              </div>
            )}
            {INSTALLED_PLUGINS.map((plugin) => {
              const Icon = plugin.icon
              const active = view === plugin.id
              return (
                <button
                  key={plugin.id}
                  onClick={() => setView(plugin.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-accent)]'
                      : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{plugin.name}</span>
                </button>
              )
            })}
          </nav>
          {onBack && (
            <button
              onClick={onBack}
              className="m-2 flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors"
            >
              <X className="w-4 h-4" /> 返回笔记
            </button>
          )}
        </aside>
      )}

      {/* 主区 */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* 顶栏：布局控制 */}
        <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-[var(--ink-border)]">
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={() => setLeftOpen((o) => !o)} title="折叠/展开导航" className={iconBtn}>
              <PanelLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium">
              {view === 'editor'
                ? '正文写作'
                : view === 'form'
                  ? '表单视图'
                  : view === 'table'
                    ? '表格视图'
                    : INSTALLED_PLUGINS.find((p) => p.id === view)?.name || '插件视图'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsTypewriter((t) => !t)}
              title="打字机视口"
              className={`${iconBtn} ${isTypewriter ? 'text-[var(--ink-accent)]' : ''}`}
            >
              <TypeIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              title="全屏 / 退出全屏"
              className={iconBtn}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setRightOpen((o) => !o)}
              title="折叠/展开信息栏"
              className={iconBtn}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 内容分发：按视图类型挂载不同容器 */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0">
            {view === 'editor' && (
              <WriterDesk
                projectId={projectId}
                isTypewriter={isTypewriter}
                onStats={setStats}
                onOpenAssistant={onOpenAssistant}
              />
            )}
            {view === 'form' && (
              <Placeholder icon={FileText} title="表单视图" desc="结构化表单容器（建设中）" />
            )}
            {view === 'table' && (
              <Placeholder icon={Table2} title="表格视图" desc="数据表格容器（建设中）" />
            )}
            {/* 动态挂载已匹配的插件主视图 */}
            {INSTALLED_PLUGINS.some((p) => p.id === view) && (
              (() => {
                const ActivePlugin = INSTALLED_PLUGINS.find((p) => p.id === view)!
                const PluginMainView = ActivePlugin.mainView
                return <PluginMainView projectId={projectId} onStats={setStats} />
              })()
            )}
          </div>

          {/* 右侧信息栏：折叠/展开；传入 rightPanel 时渲染自定义面板，否则显示默认统计 */}
          {rightOpen && !isFullscreen && (
            <aside
              className={`shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] overflow-y-auto ${
                rightPanel ? 'w-[300px]' : 'w-[220px]'
              }`}
            >
              {rightPanel ? (
                <div className="h-full">{rightPanel}</div>
              ) : (
                <div className="p-3 space-y-3 text-[12px]">
                  <div className="text-[11px] font-medium text-[var(--ink-text-faint)]">文档信息</div>
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
                    快捷键：⌘S 保存 · ⌘B 折叠导航 · ⌘\ 全屏
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}

const Row: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[var(--ink-text-faint)]">{label}</span>
    <span className="truncate text-[var(--ink-text)]">{value}</span>
  </div>
)

const Placeholder: FC<{
  icon: ComponentType<{ className?: string }>
  title: string
  desc: string
}> = ({ icon: Icon, title, desc }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--ink-text-faint)]">
    <Icon className="w-10 h-10" />
    <div className="text-[15px] font-medium text-[var(--ink-text-muted)]">{title}</div>
    <div className="text-[12px]">{desc}</div>
  </div>
)
