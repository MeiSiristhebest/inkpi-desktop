import type { ButtonHTMLAttributes, ReactNode } from 'react'

const ICON_BTN =
  'p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

/** 原子组件：统一的图标按钮（侧栏/顶栏的纯图标操作） */
export const IconButton = ({ children, className = '', ...rest }: IconButtonProps) => (
  <button type="button" className={`${ICON_BTN} ${className}`} {...rest}>
    {children}
  </button>
)
