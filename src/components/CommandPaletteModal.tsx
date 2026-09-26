import { useState, useEffect, useMemo, type FC } from 'react'
import { Search, Command as CmdIcon, CornerDownLeft, X } from 'lucide-react'
import { commandRegistry, type Command } from '../core/commandRegistry'
import type { ActiveWritingContext } from '../core/activeWritingContext'
import { Modal } from '../ui/molecules/Modal'

export interface CommandPaletteModalProps {
  isOpen: boolean
  onClose: () => void
  context?: ActiveWritingContext
}

/**
 * 命令面板。
 *
 * 这里只保留面板特有的交互：检索、候选列表、↑↓ / ↵ 导航。遮罩、role="dialog" + aria-modal、
 * 初始焦点、Tab 循环、Esc 与焦点归还全部来自 Modal（§P4.1 / §P4.2）——它此前自带一份手写的
 * 同名契约，而那份契约的焦点选择器还漏掉了 select / textarea / [tabindex] 三类控件。
 */
export const CommandPaletteModal: FC<CommandPaletteModalProps> = ({ isOpen, onClose, context }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // 动态检索匹配命令
  const commands = useMemo(() => {
    return commandRegistry.search(query, context)
  }, [query, context])

  // 候选列表键盘导航：↑↓ 移动选中项，↵ 执行当前项。Tab / Esc / 焦点归还属于 Modal 的契约。
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (commands.length > 0 ? (prev + 1) % commands.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          commands.length > 0 ? (prev - 1 + commands.length) % commands.length : 0,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (commands[selectedIndex]) {
          void commands[selectedIndex].execute(context)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, commands, selectedIndex, context, onClose])

  if (!isOpen) return null

  const handleExecute = (cmd: Command) => {
    void cmd.execute(context)
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title="命令面板"
      placement="top"
      widthClass="max-w-xl"
      overlayClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--ink-text)] mt-24"
    >
      {/* 顶部搜索框 */}
      <div className="flex items-center px-4 py-3 border-b border-[var(--ink-border)] gap-2.5">
        <Search className="w-4 h-4 text-[var(--ink-text-muted)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          placeholder="搜索命令、视图、能力、插件或快捷操作…"
          aria-label="搜索命令"
          aria-controls="command-palette-listbox"
          aria-activedescendant={
            commands[selectedIndex]
              ? `command-palette-item-${commands[selectedIndex].id}`
              : undefined
          }
          className="flex-1 text-[13px] bg-transparent border-none focus:outline-none text-[var(--ink-text)] placeholder-[var(--ink-text-faint)]"
        />
        {query && (
          <button
            type="button"
            aria-label="清除搜索"
            onClick={() => setQuery('')}
            className="p-1 text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[var(--ink-text-faint)]">
          ESC
        </span>
      </div>

      {/* 命令候选列表 */}
      <div
        id="command-palette-listbox"
        role="listbox"
        aria-label="命令候选列表"
        className="max-h-80 overflow-y-auto p-2 space-y-1"
      >
        {commands.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-[var(--ink-text-faint)]">
            未找到匹配的命令或能力
          </div>
        ) : (
          commands.map((cmd, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                type="button"
                key={cmd.id}
                id={`command-palette-item-${cmd.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                data-testid={`command-item-${cmd.id}`}
                onClick={() => handleExecute(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-[13px] ${
                  isSelected
                    ? 'bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-medium'
                    : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CmdIcon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="truncate">{cmd.title}</span>
                  {cmd.category && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text-muted)] shrink-0">
                      {cmd.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[11px] text-[var(--ink-text-faint)]">
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded font-mono bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  {isSelected && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* 底部帮助提示 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/50 text-[11px] text-[var(--ink-text-faint)]">
        <span>共 {commands.length} 个可用指令</span>
        <div className="flex items-center gap-3">
          <span>↑↓ 选择</span>
          <span>↵ 确认</span>
          <span>Esc 退出</span>
        </div>
      </div>
    </Modal>
  )
}
