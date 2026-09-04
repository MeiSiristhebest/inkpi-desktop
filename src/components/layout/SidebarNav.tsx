import React, { useState, useMemo } from 'react'
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
  Search,
  X,
  Compass,
  Zap,
  Palette,
} from 'lucide-react'
import { useResizableWidth } from '../../hooks/useResizableWidth'
import { useOptionalPluginRegistry, ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'
import type { DesktopPlugin, DesktopPluginCategory } from '../../types/plugin'

interface SidebarNavProps {
  activeTabId: string
  onSelectTab: (tabId: string) => void
  projectName: string
  onBackToHome?: () => void
  onOpenSettings: () => void
  onClose: () => void
}

const CATEGORY_META: Record<
  DesktopPluginCategory,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  lore: { label: '设定与世界书', icon: BookOpen },
  plot: { label: '大纲与因果', icon: Compass },
  rhythm: { label: '网文节奏', icon: Zap },
  craft: { label: '修辞与调色', icon: Palette },
  review: { label: '质检与门禁', icon: ShieldAlert },
  flow: { label: '心流与竞技', icon: Sparkles },
  tools: { label: '辅助与工具', icon: FileSpreadsheet },
}

const CATEGORY_ORDER: DesktopPluginCategory[] = [
  'lore',
  'plot',
  'rhythm',
  'craft',
  'review',
  'flow',
  'tools',
]

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTabId,
  onSelectTab,
  projectName,
  onOpenSettings,
  onClose,
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    lore: false, // 默认展开第一个核心世界书分类
    plot: true,
    rhythm: true,
    craft: true,
    review: true,
    flow: true,
    tools: true,
  })
  const [searchQuery, setSearchQuery] = useState('')

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

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  // 过滤并归类插件
  const groupedCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? activePlugins.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q),
        )
      : activePlugins

    const map = new Map<DesktopPluginCategory, DesktopPlugin[]>()
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, [])
    }
    for (const p of filtered) {
      const cat = (p.category || 'tools') as DesktopPluginCategory
      if (map.has(cat)) {
        map.get(cat)!.push(p)
      } else {
        map.get('tools')!.push(p)
      }
    }

    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_META[cat]?.label || cat,
      icon: CATEGORY_META[cat]?.icon || Sparkles,
      plugins: map.get(cat) || [],
    })).filter((group) => group.plugins.length > 0)
  }, [activePlugins, searchQuery])

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
              <span className="text-xs text-[var(--ink-text-muted)] truncate">创作工作台</span>
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
          <span className="text-xs text-[var(--ink-text-muted)] block">当前作品</span>
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

        {/* 插件搜索栏 */}
        {activePlugins.length > 0 && (
          <div className="px-2 py-1.5 border-b border-[var(--ink-border)]/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ink-text-faint)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索插件…"
                className="w-full pl-6 pr-6 py-1 text-xs rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ink-text-faint)] hover:text-[var(--ink-text)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 插件分类折叠列表 */}
        <div className="flex-1 overflow-y-auto">
          {activePlugins.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center h-full">
              <p className="text-xs text-[var(--ink-text-faint)] leading-relaxed">
                当前未启用附加插件
              </p>
              <p className="text-xs text-[var(--ink-text-faint)] mt-0.5 opacity-70">
                纯粹专注正文创作
              </p>
            </div>
          ) : groupedCategories.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--ink-text-faint)]">
              未找到匹配「{searchQuery}」的插件
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {groupedCategories.map(({ category, label, icon: CatIcon, plugins }) => {
                const isCollapsed = collapsedCategories[category] ?? false
                return (
                  <div key={category} className="mb-0.5">
                    {/* 分类头部 */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] cursor-pointer rounded hover:bg-[var(--ink-bg-hover)]/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CatIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{label}</span>
                        <span className="text-xs opacity-70 tabular-nums shrink-0">
                          ({plugins.length})
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      )}
                    </button>

                    {/* 分类内插件列表 */}
                    {!isCollapsed && (
                      <div className="pl-2 mt-0.5 ml-2 border-l border-[var(--ink-border)]/40 space-y-px">
                        {plugins.map((p) => {
                          const Icon = p.icon || Sparkles
                          const isActive = activeTabId === p.id
                          return (
                            <button
                              key={p.id}
                              onClick={() => onSelectTab(p.id)}
                              className={`w-full text-left px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                isActive
                                  ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                                  : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
                              }`}
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{p.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
