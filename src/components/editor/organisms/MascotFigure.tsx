import React from 'react'
import { Sparkles } from 'lucide-react'

interface MascotFigureProps {
  className?: string
}

/**
 * 官方小助码字极简占位组件（去除了小人图，符合 Apple / Notion 的克制高级感）
 */
export const MascotFigure: React.FC<MascotFigureProps> = ({ className = 'w-24 h-24' }) => {
  return (
    <div
      className={`${className} rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] flex flex-col items-center justify-center text-[var(--ink-text-muted)] select-none transition-colors hover:border-[var(--ink-border-strong)]`}
    >
      <div className="w-8 h-8 rounded-xl bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] flex items-center justify-center shadow-2xs mb-1.5">
        <Sparkles className="w-4 h-4" />
      </div>
      <span className="text-[11px] font-medium tracking-tight text-[var(--ink-text-muted)]">
        小助码字
      </span>
    </div>
  )
}
