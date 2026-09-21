import React, { type ReactNode, useId, useEffect, useRef } from 'react'
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
  /** 面板标题文本（自动关联 aria-labelledby） */
  title?: string
  /** Use a visible heading supplied by the child content as the dialog label. */
  ariaLabelledBy?: string
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
}) => {
  const id = useId()
  const titleId = title ? `modal-title-${id}` : undefined
  const labelledBy = ariaLabelledBy ?? titleId
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Save trigger focus on open, restore on unmount/close
  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = panelRef.current
    if (!el) return
    // Focus first focusable descendant
    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    const first = focusable[0]
    if (first) {
      first.focus()
    } else {
      el.setAttribute('tabindex', '-1')
      el.focus()
    }

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusableInside = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusableInside.length === 0) return
      const currentIndex = focusableInside.indexOf(document.activeElement as HTMLElement)
      const nextIndex = e.shiftKey
        ? currentIndex <= 0
          ? focusableInside.length - 1
          : currentIndex - 1
        : currentIndex === focusableInside.length - 1
          ? 0
          : currentIndex + 1
      e.preventDefault()
      focusableInside[nextIndex]?.focus()
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', trapFocus)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', trapFocus)
      window.removeEventListener('keydown', handleEsc)
      triggerRef.current?.focus()
      triggerRef.current = null
    }
  }, [onClose])

  return (
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
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`w-full ${widthClass} ${panelClassName}`}
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
