import React from 'react'
import { TAB_DEFINITIONS as tabDefinitions } from '../../config/tabDefinitions'
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  Sparkles,
  ShieldAlert,
  FileSpreadsheet,
  Settings as SettingsIcon,
  PanelLeftClose,
} from 'lucide-react'
import { useResizableWidth } from '../../hooks/useResizableWidth'
import { useOptionalPluginRegistry, ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'

interface SidebarNavProps {
  activeTabId: string
  onSelectTab: (tabId: string) => void
  projectName: string
  onBackToHome?: () => void
  onOpenSettings: () => void
  onClose: () => void
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTabId,
  onSelectTab,
  projectName,
  onOpenSettings,
  onClose,
}) => {
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({
    世界构建: true,
    创作管理: true,
    运营维护: true,
  })
  const [showLegacyModules, setShowLegacyModules] = React.useState<boolean>(false)
  const pluginCtx = useOptionalPluginRegistry()
  const activePlugins = pluginCtx?.activePlugins ?? ALL_AVAILABLE_PLUGINS

  // 侧边栏宽度可调：默认 240px，最小 180px，最大 360px，记忆持久化
  const { width, isDragging, onMouseDown, resetWidth } = useResizableWidth({
    initialWidth: 240,
    minWidth: 180,
    maxWidth: 360,
    storageKey: 'inkpi-sidebar-nav-width',
    direction: 'left',
  })

  // Group tabs by group name
  const groups: Record<string, typeof tabDefinitions> = {}
  for (const tab of tabDefinitions) {
    const g = tab.group || '其他模块'
    if (!groups[g]) groups[g] = []
    groups[g].push(tab)
  }

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
  }

  const getGroupIcon = (groupName: string) => {
    switch (groupName) {
      case '工作面板':
        return <LayoutDashboard className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
      case '大纲规划':
        return <BookOpen className="w-3.5 h-3.5 text-blue-500" />
      case '灵感工具':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />
      case '运营维护':
        return <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
      default:
        return <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
    }
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-screen border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col justify-between select-none text-[var(--ink-text)] z-20 shrink-0 relative group"
    >
      {/* 拖拽手柄：右侧边线，带悬浮光标与宽度约束 */}
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={resetWidth}
        title="拖拽调整侧边栏宽度（双击恢复默认）"
        className={`absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize z-30 transition-colors ${
          isDragging ? 'bg-[var(--ink-accent)] w-[3px]' : 'hover:bg-[var(--ink-accent)]/50'
        }`}
      />

      {/* Top Project Badge */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-11 flex items-center justify-between px-3 border-b border-[var(--ink-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center text-xs shrink-0 font-serif">
              墨
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate">InkPi</span>
              <span className="text-[10px] text-[var(--ink-text-muted)] truncate">创作工作台</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
            title="收起导航"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Current Project */}
        <div className="px-3 py-2 bg-[var(--ink-bg-active)]/40 border-b border-[var(--ink-border)]">
          <span className="text-[10px] text-[var(--ink-text-muted)] block">当前作品</span>
          <span className="text-xs font-semibold truncate block">
            {projectName || '未命名小说'}
          </span>
        </div>

        {/* Quick Nav: Dashboard & Editor */}
        <div className="p-2 border-b border-[var(--ink-border)]/50 space-y-0.5">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
              activeTabId === 'dashboard'
                ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>写作面板</span>
          </button>
          <button
            onClick={() => onSelectTab('editor')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
              activeTabId === 'editor'
                ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>正文写作</span>
          </button>
        </div>

        {/* 已启用插件套件快速直达 */}
        {activePlugins.length > 0 && (
          <div className="p-2 border-b border-[var(--ink-border)]/50 space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--ink-text-muted)] flex items-center justify-between">
              <span>插件套件</span>
              <span className="text-[9px] opacity-70">({activePlugins.length})</span>
            </div>
            {activePlugins.map((p) => {
              const Icon = p.icon || Sparkles
              const isActive = activeTabId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectTab(p.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                      : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* 插件拓展与预留模块列表（默认全部隐藏，仅保留作架构参考） */}
        {showLegacyModules ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] text-[var(--ink-text-faint)]">
              <span>预留插件功能模块（已停用）</span>
              <button
                onClick={() => setShowLegacyModules(false)}
                className="hover:text-[var(--ink-text)] transition-colors underline"
              >
                隐藏
              </button>
            </div>
            {Object.entries(groups).map(([groupName, tabs]) => {
              const isCollapsed = collapsedGroups[groupName]
              return (
                <div key={groupName} className="mb-1">
                  <div
                    onClick={() => toggleGroup(groupName)}
                    className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] cursor-pointer rounded hover:bg-[var(--ink-bg-hover)]/50"
                  >
                    <div className="flex items-center gap-1.5">
                      {getGroupIcon(groupName)}
                      <span>{groupName}</span>
                      <span className="text-[10px] opacity-70">({tabs.length})</span>
                    </div>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="pl-2 space-y-0.5 mt-0.5 border-l border-[var(--ink-border)]/50 ml-2">
                      {tabs
                        .filter((t) => t.id !== 'dashboard')
                        .map((t) => {
                          const isActive = activeTabId === t.id
                          return (
                            <button
                              key={t.id}
                              onClick={() => onSelectTab(t.id)}
                              className={`w-full text-left px-2 py-1 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                                isActive
                                  ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                                  : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                              }`}
                            >
                              <span className="truncate">{t.name}</span>
                              {t.minimal && (
                                <span className="text-[9px] opacity-70 border border-current px-1 rounded scale-90">
                                  核心
                                </span>
                              )}
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <p className="text-[11px] text-[var(--ink-text-faint)] leading-relaxed">
              当前未启用附加插件
            </p>
            <p className="text-[10px] text-[var(--ink-text-faint)] mt-0.5 opacity-70">
              纯粹专注正文创作
            </p>
            <button
              type="button"
              onClick={() => setShowLegacyModules(true)}
              className="mt-3 text-[10px] text-[var(--ink-text-faint)] hover:text-[var(--ink-text-muted)] border border-dashed border-[var(--ink-border)] rounded-md px-2 py-1 hover:border-[var(--ink-border-strong)] transition-all cursor-pointer"
            >
              查看预留插件模块参考
            </button>
          </div>
        )}
      </div>

      {/* Bottom Settings Switcher */}
      <div className="p-2 border-t border-[var(--ink-border)] flex items-center justify-between text-xs text-[var(--ink-text-muted)]">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
