/** 原子组件：标签 / 值 的双列行（用于信息栏、设置项等） */
export const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[var(--ink-text-faint)]">{label}</span>
    <span className="truncate text-[var(--ink-text)]">{value}</span>
  </div>
)
