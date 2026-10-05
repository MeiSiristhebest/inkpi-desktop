import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
  type FC,
  type ReactElement,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, variants, tween } from '../../motion'
import { useOverlayFocus } from '../useOverlayFocus'

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

  const updatePosition = useCallback(() => {
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
  }, [align, offset])

  // Open handler
  const handleOpen = useCallback(() => {
    setOpen(true)
    // Need next frame to measure panel size
    requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition)
    })
  }, [updatePosition])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  // 焦点契约与 Modal 共用一份实现：打开时交给面板内首个可聚焦控件，Tab 在面板内循环，
  // Esc 关闭，关闭后把焦点还给触发者。
  useOverlayFocus({ containerRef: panelRef, active: open, onClose: handleClose })

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
  }, [open, updatePosition])

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
      // SAFETY: this fallback branch renders a button, so the HTMLElement ref is a compatible button ref.
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
