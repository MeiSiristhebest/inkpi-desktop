import type { ComponentType } from 'react'

export interface StatCardProps {
  label: string
  value: string
  sub: string
  icon: ComponentType<{ className?: string }>
  accent?: boolean
}

/** 原子组件：统计卡片（写作面板的 4 张概览卡） */
export const StatCard = ({ label, value, sub, icon: Icon, accent = false }: StatCardProps) => (
  <div className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm transition-all duration-200 ease-[var(--ink-ease)] hover:shadow-md hover:-translate-y-0.5">
    <div className="flex items-center justify-between text-[12px] text-[var(--ink-text-faint)]">
      <span>{label}</span>
      <Icon className={`w-4 h-4 ${accent ? 'text-amber-500' : 'text-[var(--ink-accent)]'}`} />
    </div>
    <div className="text-2xl font-bold mt-2 tracking-tight">{value}</div>
    <div className="text-[11px] text-[var(--ink-text-faint)] mt-1">{sub}</div>
  </div>
)
