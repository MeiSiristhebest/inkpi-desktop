import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { spring, variants, gesture } from '../../motion'

interface DrawerProps {
  /** 锚定宽度类，默认 w-[380px] */
  widthClass?: string
  children: ReactNode
}

/**
 * 停靠式侧边面板外壳（原子设计 · molecules）。
 * 基于 motion 提供全局丝滑右侧滑入 (Slide-in-Right) 与弹性阻尼。
 * 一处升级，分屏对照台、备忘录及全局右侧面板统一享受物理级平滑抽屉展开。
 */
export const Drawer = ({ widthClass = 'w-[380px]', children }: DrawerProps) => (
  <motion.aside
    {...variants.slideInFromRight}
    transition={spring.gentle}
    className={`${widthClass} shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col h-full z-20 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] select-none`}
  >
    {children}
  </motion.aside>
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
    <motion.button
      onClick={onClose}
      title={closeTitle}
      {...gesture.iconButton}
      transition={spring.snappy}
      className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
    >
      <X className="w-4 h-4" />
    </motion.button>
  </div>
)
