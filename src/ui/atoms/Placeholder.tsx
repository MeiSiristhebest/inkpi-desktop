import type { ComponentType, ReactNode } from 'react'
import { Button } from '../primitives'

export interface PlaceholderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  desc: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'secondary' | 'outline'
  }
  children?: ReactNode
  className?: string
}

/** 原子组件：占位空状态（建设中 / 无数据等），支持可选 CTA 引导按钮与自定义内容插槽 */
export const Placeholder = ({
  icon: Icon,
  title,
  desc,
  action,
  children,
  className = '',
}: PlaceholderProps) => (
  <div
    role="status"
    className={`h-full flex flex-col items-center justify-center p-6 text-center gap-3 text-[var(--ink-text-faint)] select-none ${className}`}
  >
    <div className="w-12 h-12 rounded-2xl bg-[var(--ink-bg-hover)] flex items-center justify-center text-[var(--ink-text-muted)]">
      <Icon className="w-6 h-6" />
    </div>
    <div className="space-y-1 max-w-xs">
      <div className="text-[14px] font-medium text-[var(--ink-text)]">{title}</div>
      <div className="text-[12px] leading-relaxed text-[var(--ink-text-muted)]">{desc}</div>
    </div>
    {action && (
      <Button
        variant={action.variant ?? 'secondary'}
        size="sm"
        onClick={action.onClick}
        className="mt-1 cursor-pointer"
      >
        {action.label}
      </Button>
    )}
    {children}
  </div>
)
