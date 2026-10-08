import type { ComponentType, ReactNode } from 'react'

export interface StatCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: ComponentType<{ className?: string }>
  accent?: boolean
  trend?: {
    direction: 'up' | 'down'
    label?: string
  }
  className?: string
}

/** 原子组件：统计卡片（具备 <dl>/<dt>/<dd> 语义化无障碍结构） */
export const StatCard = ({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
  trend,
  className = '',
}: StatCardProps) => (
  <dl
    className={`p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm transition-all duration-200 ease-[var(--ink-ease)] hover:shadow-md hover:-translate-y-0.5 ${className}`}
  >
    <div className="flex items-center justify-between text-[12px] text-[var(--ink-text-faint)]">
      <dt className="font-medium text-[var(--ink-text-muted)]">{label}</dt>
      <Icon
        aria-hidden="true"
        className={`w-4 h-4 ${accent ? 'text-[var(--ink-accent)]' : 'text-[var(--ink-text-muted)]'}`}
      />
    </div>
    <dd className="text-2xl font-bold mt-2 tracking-tight text-[var(--ink-text)] flex items-baseline gap-2">
      <span>{value}</span>
      {trend && (
        <span
          className={`text-xs font-normal flex items-center ${
            trend.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'
          }`}
          aria-label={trend.label ?? (trend.direction === 'up' ? '较前上升' : '较前下降')}
        >
          {trend.direction === 'up' ? '↑' : '↓'}
          {trend.label && <span className="ml-0.5">{trend.label}</span>}
        </span>
      )}
    </dd>
    {sub && <dd className="text-[11px] text-[var(--ink-text-faint)] mt-1">{sub}</dd>}
  </dl>
)
