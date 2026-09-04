import type { ReactNode } from 'react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  /** 该项之前渲染一条分隔线（用于分组，如危险操作前） */
  dividerBefore?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  /** 锚定宽度类，默认 w-36 */
  widthClass?: string
}

/**
 * 通用气泡菜单（原子设计 · molecules）。
 * 只负责「锚定浮层 + 条目列表 + 危险态配色」的展示外壳，条目由调用方以配置驱动（§10/§11）。
 */
export const ContextMenu = ({ items, widthClass = 'w-36' }: ContextMenuProps) => (
  <div
    className={`absolute right-0 top-8 z-30 ${widthClass} py-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12.5px]`}
  >
    {items.map((it) => (
      <div key={it.key}>
        {it.dividerBefore && <div className="border-t border-[var(--ink-border)] my-1" />}
        <button
          type="button"
          title={it.label}
          onClick={it.onClick}
          className={`w-full px-3 py-1.5 text-left flex items-center gap-2 cursor-pointer ${
            it.danger
              ? 'text-[var(--ink-danger)] hover:bg-[var(--ink-danger)]/10'
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
