import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { gesture, spring } from '../../motion'
import { Tooltip } from '../primitives'

const ICON_BTN =
  'p-1.5 min-w-8 min-h-8 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150 cursor-pointer inline-flex items-center justify-center select-none'

export interface IconButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  /** 无障碍名称（用于 aria-label），纯图标按钮必备 */
  label: string
  /**
   * 是否自动挂载 Tooltip 浮层。
   * 默认为 false（因历史代码多数在外层显式包裹了 <Tooltip>）；
   * 若设为 true 或直接传入 tooltip 文本，则自动包裹 <Tooltip content={...}>
   */
  tooltip?: string | boolean
}

/** 原子组件：统一的图标按钮（侧栏/顶栏的纯图标操作），基于 motion 提供细腻的 hover 微放与 tap 按压触感 */
export const IconButton = ({
  children,
  label,
  tooltip,
  className = '',
  ...rest
}: IconButtonProps) => {
  const buttonEl = (
    <motion.button
      type="button"
      aria-label={label}
      {...gesture.iconButton}
      transition={spring.snappy}
      className={`${ICON_BTN} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )

  if (tooltip) {
    const tooltipText = typeof tooltip === 'string' ? tooltip : label
    return <Tooltip content={tooltipText}>{buttonEl}</Tooltip>
  }

  return buttonEl
}
