import React, { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, variants, tween } from '../../motion'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  /** 面板宽度类，默认 max-w-lg */
  widthClass?: string
  /** 遮罩层类，默认半透明黑 + 背景模糊；LockModal 等可用 bg-black/60 加深 */
  overlayClassName?: string
  /** 面板外壳类（覆盖默认 elevated 卡片样式） */
  panelClassName?: string
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean
}

/**
 * 通用模态外壳（原子设计 · molecules）。
 * 基于 motion 提供全局 Apple 级弹簧缩放入场与平滑遮罩淡入淡出。
 * 一处升级，全局所有消费此组件的模态弹窗（字数、敏感词、锁定、历史等）同步具备高级物理动效。
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  widthClass = 'max-w-lg',
  overlayClassName = 'bg-black/40 backdrop-blur-sm',
  panelClassName = 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--ink-text)]',
  closeOnBackdrop = true,
}) => (
  <AnimatePresence>
    <motion.div
      {...variants.fade}
      transition={tween.fade}
      className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName} p-4 select-none`}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        {...variants.scaleIn}
        transition={spring.gentle}
        className={`w-full ${widthClass} ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  </AnimatePresence>
)
