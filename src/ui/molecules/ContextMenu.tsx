import { useState, useRef, useEffect, type ReactNode } from 'react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  /** 该项之前渲染一条分隔线（用于分组，如危险操作前） */
  dividerBefore?: boolean
  /**
   * 互斥选择项：渲染成 role="menuitemradio" + aria-checked（P4.3）。
   * 用于「状态标记」这类当前值有意义的条目。
   */
  checked?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  /** 锚定宽度类，默认 w-36 */
  widthClass?: string
  /** 光标锚定（右键菜单）：给定时改为 fixed 定位到该坐标 */
  position?: { x: number; y: number }
  /** 菜单顶部的上下文标题（如被操作的章节名），非交互元素 */
  header?: ReactNode
  /** 无障碍名称；缺省为「选项菜单」 */
  ariaLabel?: string
  /** Called when menu is closed via Esc, backdrop click, or item selection */
  onClose?: () => void
}

/**
 * 通用气泡菜单（原子设计 · molecules）。
 * 只负责「锚定浮层 + 条目列表 + 危险态配色」的展示外壳，条目由调用方以配置驱动（§10/§11）。
 * 全站的气泡/右键菜单都走这里，键盘语义只维护这一份（P4.3）。
 *
 * ARIA:
 *   - role="menu" on container
 *   - role="menuitem" on each button, role="menuitemradio" when item.checked is set
 *   - ArrowUp / ArrowDown / Home / End navigate items
 *   - Enter / Space activates the focused item
 *   - Esc closes the menu
 *   - First item gains focus on open
 */
export const ContextMenu = ({
  items,
  widthClass = 'w-36',
  position,
  header,
  ariaLabel = '选项菜单',
  onClose,
}: ContextMenuProps) => {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const focusedIndexRef = useRef(0)

  // Keep ref in sync with state for keyboard handlers
  useEffect(() => {
    focusedIndexRef.current = focusedIndex
  }, [focusedIndex])

  // Focus first item on mount
  useEffect(() => {
    setFocusedIndex(0)
    focusedIndexRef.current = 0
    const buttons = containerRef.current?.querySelectorAll<HTMLElement>('button') ?? []
    buttons.forEach((btn, idx) => {
      btn.setAttribute('tabindex', idx === 0 ? '0' : '-1')
    })
    const firstBtn = buttons[0]
    firstBtn?.focus()

    // Listen for Escape at window level so it works even if container loses focus
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
      setFocusedIndex(-1)
      focusedIndexRef.current = -1
    }
  }, [onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
    const visibleButtons = buttons.filter((b) => !b.hidden)
    const current = focusedIndexRef.current

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        {
          const next = current < visibleButtons.length - 1 ? current + 1 : 0
          visibleButtons.forEach((b, i) => {
            b.setAttribute('tabindex', i === next ? '0' : '-1')
          })
          visibleButtons[next]?.focus()
          setFocusedIndex(next)
          focusedIndexRef.current = next
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        {
          const next = current > 0 ? current - 1 : visibleButtons.length - 1
          visibleButtons.forEach((b, i) => {
            b.setAttribute('tabindex', i === next ? '0' : '-1')
          })
          visibleButtons[next]?.focus()
          setFocusedIndex(next)
          focusedIndexRef.current = next
        }
        break
      case 'Home':
        e.preventDefault()
        if (visibleButtons.length > 0) {
          visibleButtons[0].focus()
          setFocusedIndex(0)
          focusedIndexRef.current = 0
        }
        break
      case 'End':
        e.preventDefault()
        if (visibleButtons.length > 0) {
          visibleButtons[visibleButtons.length - 1].focus()
          setFocusedIndex(visibleButtons.length - 1)
          focusedIndexRef.current = visibleButtons.length - 1
        }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        visibleButtons[current]?.click()
        break
    }
  }

  const handleItemClick = (_index: number, item: ContextMenuItem) => {
    item.onClick()
    onClose?.()
  }

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label={ariaLabel}
      className={`z-50 ${widthClass} py-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12.5px] ${
        position ? 'fixed' : 'absolute right-0 top-8'
      }`}
      style={position ? { left: position.x, top: position.y } : undefined}
      onKeyDown={handleKeyDown}
    >
      {header && (
        <div className="px-3 py-1.5 mb-1 border-b border-[var(--ink-border)]/60 text-[11px] text-[var(--ink-text-faint)] truncate font-medium">
          {header}
        </div>
      )}
      {items.map((it, idx) => (
        <div key={it.key} role="none">
          {it.dividerBefore && (
            <div className="border-t border-[var(--ink-border)] my-1" role="separator" />
          )}
          <button
            type="button"
            role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={it.checked}
            title={it.label}
            aria-disabled={false}
            onClick={() => handleItemClick(idx, it)}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 cursor-pointer ${
              it.danger
                ? 'text-[var(--ink-danger)] hover:bg-[var(--ink-danger)]/10'
                : it.checked
                  ? 'text-[var(--ink-accent)] bg-[var(--ink-accent)]/10 hover:bg-[var(--ink-accent)]/15'
                  : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            {it.icon && <span className="[&>svg]:text-[var(--ink-text-muted)]">{it.icon}</span>}
            {it.label}
          </button>
        </div>
      ))}
    </div>
  )
}
