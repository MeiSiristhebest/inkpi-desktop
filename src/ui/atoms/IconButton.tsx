import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { gesture, spring } from '../../motion'

const ICON_BTN =
  'p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150 cursor-pointer inline-flex items-center justify-center select-none'

export interface IconButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode
}

/** 原子组件：统一的图标按钮（侧栏/顶栏的纯图标操作），基于 motion 提供细腻的 hover 微放与 tap 按压触感 */
export const IconButton = ({ children, className = '', ...rest }: IconButtonProps) => (
  <motion.button
    type="button"
    {...gesture.iconButton}
    transition={spring.snappy}
    className={`${ICON_BTN} ${className}`}
    {...rest}
  >
    {children}
  </motion.button>
)
