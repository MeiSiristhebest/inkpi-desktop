import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  /** 锚定宽度类，默认 w-[380px] */
  widthClass?: string
  children: ReactNode
}

/**
 * 停靠式侧边面板外壳（原子设计 · molecules）。
 * 仅负责「右侧固定栏 + 边框/阴影/背景」的布局外壳；分屏对照台、行旁备忘等具体面板
 * 在内部自行组合（§10/§11）。区别于 Modal/Drawer 浮层：本侧栏常驻于编辑区右侧、不遮罩。
 */
export const Drawer = ({ widthClass = 'w-[380px]', children }: DrawerProps) => (
  <aside
    className={`${widthClass} shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col h-full z-20 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] select-none`}
  >
    {children}
  </aside>
)

interface DrawerHeaderProps {
  icon?: ReactNode
  title: string
  onClose: () => void
  closeTitle?: string
}

/** 侧边面板通用顶栏：标题（含可选图标）+ 关闭按钮（§10/§11）。 */
export const DrawerHeader = ({ icon, title, onClose, closeTitle }: DrawerHeaderProps) => (
  <div className="h-11 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-text)]">
      {icon}
      <span>{title}</span>
    </div>
    <button
      onClick={onClose}
      title={closeTitle}
      className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
)
