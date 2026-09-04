import type { ComponentType } from 'react'

/** 原子组件：占位空状态（建设中 / 无数据等） */
export const Placeholder = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  desc: string
}) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--ink-text-faint)]">
    <Icon className="w-10 h-10" />
    <div className="text-[15px] font-medium text-[var(--ink-text-muted)]">{title}</div>
    <div className="text-[12px]">{desc}</div>
  </div>
)
