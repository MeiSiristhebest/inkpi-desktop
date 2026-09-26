import React, { type ReactNode, useId, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, variants, tween } from '../../motion'
import { useOverlayFocus } from '../useOverlayFocus'

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
  /** 面板标题文本（自动关联 aria-labelledby） */
  title?: string
  /** Use a visible heading supplied by the child content as the dialog label. */
  ariaLabelledBy?: string
  /**
   * 面板停靠方式。center = 居中对话框（默认）；top = 顶部停靠（命令面板这类
   * 「贴顶 + 居中宽度」的浮层）；right = 右侧全高抽屉（编辑面板等需要大表单的场景）。
   * 三者只有停靠位置与入场动画不同，ARIA / 焦点契约完全一致，
   * 避免为任何一种浮层再写一份模态实现。
   */
  placement?: 'center' | 'top' | 'right'
}

/**
 * 通用模态外壳（原子设计 · molecules）。
 * 基于 motion 提供全局 Apple 级弹簧缩放入场与平滑遮罩淡入淡出。
 * 一处升级，全局所有消费此组件的模态弹窗（字数、敏感词、锁定、历史等）同步具备高级物理动效 + 完整 ARIA 语义。
 *
 * ARIA:
 *   - role="dialog" + aria-modal="true" on panel
 *   - aria-labelledby → h2#title-{id} when title is provided
 *   - Esc closes; focus-trap cycles within dialog
 *   - On open: focuses first focusable element; on close: restores trigger focus
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  widthClass = 'max-w-lg',
  overlayClassName = 'bg-black/40 backdrop-blur-sm',
  panelClassName = 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--ink-text)]',
  closeOnBackdrop = true,
  title,
  ariaLabelledBy,
  placement = 'center',
}) => {
  const id = useId()
  const dockedRight = placement === 'right'
  const titleId = title ? `modal-title-${id}` : undefined
  const labelledBy = ariaLabelledBy ?? titleId
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlayFocus({ containerRef: panelRef, active: true, onClose })

  const alignment =
    placement === 'right'
      ? 'items-stretch justify-end'
      : placement === 'top'
        ? 'items-start justify-center'
        : 'items-center justify-center'

  return (
    <AnimatePresence>
      <motion.div
        {...variants.fade}
        transition={tween.fade}
        className={`fixed inset-0 z-50 flex ${alignment} ${overlayClassName} p-4 select-none`}
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          {...(dockedRight ? variants.slideInFromRight : variants.scaleIn)}
          transition={spring.gentle}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`${dockedRight ? '' : 'w-full'} ${widthClass} ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && !ariaLabelledBy && (
            <div className="sr-only">
              <span id={titleId}>{title}</span>
            </div>
          )}
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
