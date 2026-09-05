import type { FC } from 'react'
import { Loader2 } from 'lucide-react'

export interface PluginSuspenseFallbackProps {
  label?: string
}

export const PluginSuspenseFallback: FC<PluginSuspenseFallbackProps> = ({
  label = '组件加载中...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-12 text-sm text-[var(--ink-text-muted)] gap-3 min-h-[220px]"
    >
      <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-accent)]" />
      <span>{label}</span>
    </div>
  )
}
