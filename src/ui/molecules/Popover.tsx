import React, {
  useState,
  useRef,
  useEffect,
  useId,
  type ReactNode,
  type FC,
  type ReactElement,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, variants, tween } from '../../motion'

interface PopoverProps {
  trigger: ReactNode
  title?: string
  description?: string
  children: ReactNode
  /** Position anchor class, default "start" */
  align?: 'start' | 'center' | 'end'
  /** Offset from trigger in px, default 8 */
  offset?: number
  /** Custom width class for the popover panel */
  widthClass?: string
  /** Custom panel className override */
  panelClassName?: string
  /** Custom overlay className */
  overlayClassName?: string
  /** Whether clicking the backdrop closes the popover, default true */
  closeOnBackdrop?: boolean
}

/**
 * 通用弹出浮层（原子设计 · molecules）。
 * 触发器点击展开，带运动动效；一处升级，全局 popover 统一具备高级物理动效 + 完整 ARIA 语义。
 *
 * ARIA:
 *   - role="dialog" + aria-modal="true" on panel
 *   - aria-labelledby → h2 when title is provided
 *   - aria-describedby when description is provided
 *   - Esc closes; focus-trap cycles within popover
 *   - On open: focuses first focusable element; on close: restores trigger focus
 */
export const Popover: FC<PopoverProps> = ({
  trigger,
  title,
  description,
  children,
  align = 'start',
  offset = 8,
  widthClass = 'w-64',
  panelClassName = 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden text-[var(--ink-text)]',
  overlayClassName = 'bg-black/40 backdrop-blur-sm',
  closeOnBackdrop = true,
}) => {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const titleId = title ? `popover-title-${id}` : undefined
  const describedById = description ? `popover-desc-${id}` : undefined

  // Position tracking
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    let left = rect.left
    if (align === 'center') left = rect.left + rect.width / 2
    else if (align === 'end') left = rect.right

    // Keep within viewport
    const panelW = panelRef.current?.offsetWidth ?? 256
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8))

    let top = rect.bottom + offset
    const panelH = panelRef.current?.offsetHeight ?? 200
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelH - offset)
    }

    setPosition({ left, top })
  }

  // Open handler
  const handleOpen = () => {
    setOpen(true)
    // Need next frame to measure panel size
    requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition)
    })
  }

  const handleClose = () => {
    setOpen(false)
  }

  // Focus management: on open, focus first focusable; on close, restore trigger
  useEffect(() => {
    if (!open) return

    const el = panelRef.current
    if (!el) return

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
        handleClose()
      }
    }

    window.addEventListener('keydown', trapFocus)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', trapFocus)
      window.removeEventListener('keydown', handleEsc)
      triggerRef.current?.focus()
    }
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    const handler = () => updatePosition()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open])

  // Clone trigger and attach open handler + ref + ARIA attrs
  const cloneTrigger = (node: ReactNode): ReactNode => {
    if (React.isValidElement(node)) {
      const extraProps: Record<string, unknown> = {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          handleOpen()
        },
        ref: triggerRef,
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
      }
      // Merge with existing props — call existing first, then our open handler
      const existingOnClick = (node.props as Record<string, unknown>)?.onClick as
        ((e: React.MouseEvent) => void) | undefined
      if (existingOnClick) {
        const savedOnClick = extraProps.onClick as (e: React.MouseEvent) => void
        extraProps.onClick = (e: React.MouseEvent) => {
          existingOnClick(e)
          savedOnClick(e)
        }
      }
      return React.cloneElement(node as ReactElement, extraProps)
    }
    // Fallback: wrap non-element nodes in a button
    return (
      <button
        ref={triggerRef as unknown as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={handleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {node}
      </button>
    )
  }

  return (
    <span className="inline-flex">
      {cloneTrigger(trigger)}

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              {...variants.fade}
              transition={tween.fade}
              className={`fixed inset-0 z-40 ${overlayClassName}`}
              onClick={(e) => {
                if (closeOnBackdrop && e.target === e.currentTarget) handleClose()
              }}
            />
            {/* Panel */}
            <motion.div
              {...variants.scaleIn}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring.gentle}
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={describedById}
              style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                zIndex: 50,
              }}
              onClick={(e) => e.stopPropagation()}
              className={`${widthClass} ${panelClassName}`}
            >
              {(title || description) && (
                <div className="px-4 py-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
                  {title && (
                    <h2 id={titleId} className="text-[13px] font-semibold text-[var(--ink-text)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id={describedById}
                      className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5 leading-relaxed"
                    >
                      {description}
                    </p>
                  )}
                </div>
              )}
              <div className="p-4 overflow-y-auto">{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
