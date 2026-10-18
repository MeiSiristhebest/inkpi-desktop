import type { FC } from 'react'
import { Loader2 } from 'lucide-react'

export interface SpinnerProps {
  className?: string
  size?: number
  label?: string
  decorative?: boolean
}

/** 原子组件：统一的无障碍旋转加载指示器 */
export const Spinner: FC<SpinnerProps> = ({
  className = 'w-4 h-4',
  size,
  label = '加载中…',
  decorative = false,
}) => (
  <span
    role={decorative ? undefined : 'status'}
    aria-label={decorative ? undefined : label}
    aria-hidden={decorative || undefined}
    className="inline-flex items-center justify-center"
  >
    <Loader2
      style={size ? { width: size, height: size } : undefined}
      className={`animate-spin shrink-0 ${className}`}
    />
    {!decorative && <span className="sr-only">{label}</span>}
  </span>
)
