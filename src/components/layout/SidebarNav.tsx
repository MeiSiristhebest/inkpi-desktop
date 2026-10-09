import React, { useMemo } from 'react'
import { motion } from 'motion/react'
import {
  BookOpen,
  Sparkles,
  ShieldAlert,
  FileSpreadsheet,
  Settings as SettingsIcon,
  PanelLeftClose,
  Search,
  Compass,
} from 'lucide-react'
import { spring, gesture } from '../../motion'
import { useResizableWidth } from '../../hooks/useResizableWidth'
import { useOptionalPluginRegistry, ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'
import { Tooltip } from '../../ui/primitives'

interface SidebarNavProps {
  activeTabId: string
  onSelectTab: (tabId: string) => void
  projectName: string
  onBackToHome?: () => void
  onOpenSettings: () => void
  onOpenCommandPalette: () => void
  onClose: () => void
}

const WORKSPACE_SHORTCUTS: Array<{
  id: string
  label: string
  icon: React.FC<{ className?: string }>
  pluginId?: string
}> = [
  { id: 'editor', label: '正文写作', icon: BookOpen },
  { id: 'volume-master', label: '大纲', icon: Compass, pluginId: 'volume-master' },
  { id: 'living-codex', label: '故事', icon: Sparkles, pluginId: 'living-codex' },
  { id: 'gold-chapters-eval', label: '审校', icon: ShieldAlert, pluginId: 'gold-chapters-eval' },
  {
    id: 'scrapbook-recycler',
    label: '素材库',
    icon: FileSpreadsheet,
    pluginId: 'scrapbook-recycler',
  },
]

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTabId,
  onSelectTab,
  projectName,
  onOpenSettings,
  onOpenCommandPalette,
  onClose,
}) => {
  const pluginCtx = useOptionalPluginRegistry()
  const activePlugins = pluginCtx?.activePlugins ?? ALL_AVAILABLE_PLUGINS
  const availableWorkspaces = useMemo(
    () =>
      WORKSPACE_SHORTCUTS.filter(
        (workspace) =>
          !workspace.pluginId || activePlugins.some((plugin) => plugin.id === workspace.pluginId),
      ),
    [activePlugins],
  )

  // 侧边栏宽度可调：默认 240px，最小 180px，最大 360px，记忆持久化
  const { width, isDragging, onMouseDown, resetWidth } = useResizableWidth({
    initialWidth: 240,
    minWidth: 180,
    maxWidth: 360,
    storageKey: 'inkpi-sidebar-nav-width',
    direction: 'left',
  })

  return (
    <aside
      data-testid="sidebar-nav"
      style={{ width: `${width}px` }}
      className="sidebar-nav h-screen border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col justify-between select-none text-[var(--ink-text)] z-20 shrink-0 relative group"
    >
      {/* 拖拽手柄：右侧边线，带悬浮光标与宽度约束 */}
      <Tooltip content="拖拽调整侧边栏宽度（双击恢复默认）">
        <div
          onMouseDown={onMouseDown}
          onDoubleClick={resetWidth}
          className="absolute top-0 right-[-6px] w-3 h-full cursor-col-resize z-30 transition-colors flex justify-center group"
        >
          <div
            className={`w-[2px] h-full transition-colors ${
              isDragging
                ? 'bg-[var(--ink-accent)]'
                : 'bg-transparent group-hover:bg-[var(--ink-accent)]/50'
            }`}
          />
        </div>
      </Tooltip>

      {/* Top Project Badge */}
      <div className="sidebar-nav-body flex-1 flex flex-col min-h-0">
        <div className="sidebar-nav-brand h-11 flex items-center justify-between px-3 border-b border-[var(--ink-border)]">
          <button
            type="button"
            aria-label="打开写作面板"
            title="打开写作面板"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2 min-w-0 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink-accent)]"
          >
            <span className="w-6 h-6 rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center text-xs shrink-0 font-serif">
              墨
            </span>
            <div className="sidebar-nav-brand-copy flex flex-col min-w-0">
              <span className="text-xs font-bold truncate">InkPi</span>
              <span className="text-xs text-[var(--ink-text-muted)] truncate">创作工作台</span>
            </div>
          </button>

          <Tooltip content="收起导航">
            <button
              onClick={onClose}
              className="p-1 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Current Project */}
        <div className="sidebar-nav-project px-3 py-2 bg-[var(--ink-bg-active)]/40 border-b border-[var(--ink-border)]">
          <span className="text-xs text-[var(--ink-text-muted)] block">当前作品</span>
          <span className="text-xs font-semibold truncate block">
            {projectName || '未命名小说'}
          </span>
        </div>

        <nav
          aria-label="创作工作区"
          className="sidebar-nav-quick p-2 border-b border-[var(--ink-border)]/50 space-y-1"
        >
          <span className="px-2.5 text-[10px] text-[var(--ink-text-faint)]">工作区</span>
          {availableWorkspaces.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTabId === id ? 'page' : undefined}
              onClick={() => onSelectTab(id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                activeTabId === id
                  ? 'bg-[var(--ink-accent)] text-white shadow-2xs font-semibold'
                  : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="sidebar-nav-button-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-2 py-2 border-b border-[var(--ink-border)]/50">
          <button
            type="button"
            aria-label="搜索命令与插件"
            onClick={onOpenCommandPalette}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1">搜索命令与插件</span>
            <kbd className="px-1 rounded border border-[var(--ink-border)] font-mono text-[10px]">
              Ctrl/⌘ K
            </kbd>
          </button>
        </div>
      </div>

      {/* Bottom Settings Switcher */}
      <div className="sidebar-nav-settings p-2 border-t border-[var(--ink-border)] flex items-center justify-between text-xs text-[var(--ink-text-muted)]">
        <motion.button
          type="button"
          {...gesture.listRow}
          transition={spring.snappy}
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span className="sidebar-nav-button-label">设置</span>
        </motion.button>
      </div>
    </aside>
  )
}
