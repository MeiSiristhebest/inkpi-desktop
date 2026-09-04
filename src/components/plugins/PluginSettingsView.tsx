import { useState, useMemo, type FC } from 'react'
import {
  Puzzle,
  Search,
  Layers,
  Inbox,
} from 'lucide-react'
import {
  usePluginRegistry,
} from '../../core/pluginRegistry'
import type { DesktopPlugin } from '../../types/plugin'

export const PluginSettingsView: FC = () => {
  const { allPlugins, enabledIds, togglePlugin } = usePluginRegistry()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlugin, setSelectedPlugin] = useState<DesktopPlugin | null>(allPlugins[0] || null)

  const filteredPlugins = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return allPlugins
    return allPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q)),
    )
  }, [allPlugins, searchQuery])

  const effectivePlugin =
    filteredPlugins.find((p) => p.id === selectedPlugin?.id) || filteredPlugins[0] || null

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-xl text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
        <div className="flex items-center gap-2 font-medium text-[13px]">
          <Puzzle className="w-4 h-4 text-[var(--ink-accent)]" />
          <span>扩展插件管理</span>
        </div>

        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--ink-text-faint)]" />
          <input
            type="text"
            placeholder="搜索已安装插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-[12px] bg-[var(--ink-bg)] border border-[var(--ink-border)] rounded-lg focus:outline-none focus:border-[var(--ink-accent)] text-[var(--ink-text)] placeholder-[var(--ink-text-faint)]"
          />
        </div>
      </div>

      {/* 主体区 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧已安装插件列表 */}
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--ink-bg)]">
          {filteredPlugins.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--ink-text-muted)] flex flex-col items-center gap-2">
              <Inbox className="w-8 h-8 text-[var(--ink-text-faint)] opacity-50" />
              <span>暂无已安装的插件</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-[var(--ink-text-muted)]">
                <span>已安装插件 ({filteredPlugins.length})</span>
                <span className="text-[10px] text-[var(--ink-text-faint)]">按需开启，未启用时不产生任何干扰</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {filteredPlugins.map((plugin) => {
                  const Icon = plugin.icon || Layers
                  const isEnabled = enabledIds.has(plugin.id)
                  const isSelected = selectedPlugin?.id === plugin.id

                  return (
                    <div
                      key={plugin.id}
                      onClick={() => setSelectedPlugin(plugin)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--ink-bg-elevated)] border-[var(--ink-accent)] shadow-2xs'
                          : 'bg-[var(--ink-bg-elevated)] border-[var(--ink-border)] hover:border-[var(--ink-border-strong)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium text-[13px]">
                              <span className="truncate">{plugin.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] shrink-0">
                                v{plugin.version}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--ink-text-faint)] truncate mt-0.5">
                              {plugin.description}
                            </p>
                          </div>
                        </div>

                        {/* 开关 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePlugin(plugin.id)
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? 'bg-[var(--ink-accent)]' : 'bg-[var(--ink-border-strong)]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 右侧详情 */}
        {effectivePlugin && (
          <div className="w-72 shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 flex flex-col justify-between text-xs">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-[var(--ink-text-faint)]">插件详情</div>
                <h3 className="text-sm font-semibold text-[var(--ink-text)] mt-0.5">
                  {effectivePlugin.name}
                </h3>
                <div className="text-[11px] text-[var(--ink-text-muted)] mt-1">
                  状态:{' '}
                  {enabledIds.has(effectivePlugin.id) ? (
                    <span className="text-emerald-500 font-medium">已启用</span>
                  ) : (
                    <span className="text-[var(--ink-text-faint)]">已停用</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] leading-relaxed text-[var(--ink-text-muted)] text-[11px]">
                {effectivePlugin.description}
              </div>

              {effectivePlugin.tags && effectivePlugin.tags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[var(--ink-text-faint)]">能力标签</div>
                  <div className="flex flex-wrap gap-1">
                    {effectivePlugin.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--ink-border)]">
              <button
                onClick={() => togglePlugin(effectivePlugin.id)}
                className={`w-full py-1.5 rounded-xl font-medium text-xs transition-colors shadow-2xs ${
                  enabledIds.has(effectivePlugin.id)
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                    : 'bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)]'
                }`}
              >
                {enabledIds.has(effectivePlugin.id) ? '停用此插件' : '立即启用此插件'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
