import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  type FC,
  type ReactNode,
} from 'react'
import { HelpCircle } from 'lucide-react'

export interface HelpTooltipProps {
  title: string
  children: ReactNode
  className?: string
  size?: number
  width?: string
  side?: 'left' | 'right'
}

/**
 * 业务提示说明悬浮/点击弹层（1:1复刻原版设计）
 * - 悬浮/点击触发问号图标
 * - 弹出具有书香面板质感的卡片提示框，内容自动换行，支持复杂排版
 * - 键盘 Esc 或点击外部自动关闭
 */
export const HelpTooltip: FC<HelpTooltipProps> = ({
  title,
  children,
  className = '',
  size = 13,
  width = '18rem',
  side = 'left',
}) => {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top: number; w: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleMouseEnter = () => {
    clearTimeout(leaveTimerRef.current)
  }

  const handleMouseLeave = () => {
    clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => setOpen(false), 260)
  }

  useEffect(() => {
    return () => clearTimeout(leaveTimerRef.current)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    // 解析 width 字符串（如 '18rem' -> 像素）
    let targetW = 288
    if (width.endsWith('rem')) {
      const remVal = parseFloat(width)
      targetW = remVal * 16
    } else if (width.endsWith('px')) {
      targetW = parseFloat(width)
    }
    const finalW = Math.min(targetW, window.innerWidth - 24)

    let left = side === 'left' ? rect.right - finalW : rect.left
    left = Math.max(12, Math.min(left, window.innerWidth - finalW - 12))

    const popoverH = popoverRef.current?.offsetHeight ?? 180
    let top = rect.bottom + 6
    if (top + popoverH > window.innerHeight - 12) {
      top = Math.max(12, rect.top - popoverH - 6)
    }

    setCoords((prev) =>
      prev && prev.left === left && prev.top === top && prev.w === finalW
        ? prev
        : { left, top, w: finalW },
    )
  }, [width, side])

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    updatePosition()
    const rafId = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(rafId)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handleScrollOrResize = () => updatePosition()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, updatePosition])

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={`p-0.5 rounded transition-colors cursor-pointer ${
          open
            ? 'text-[var(--ink-accent)]'
            : 'text-[var(--ink-text-faint)] hover:text-[var(--ink-accent)]'
        }`}
        title={`${title}（点击查看说明）`}
        aria-label={title}
      >
        <HelpCircle style={{ width: size, height: size }} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: coords?.left ?? 0,
            top: coords?.top ?? 0,
            width: coords?.w ?? 288,
            zIndex: 9999,
          }}
          className="rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border-strong)] p-3.5 shadow-2xl text-[12px] text-[var(--ink-text)] leading-relaxed select-text animate-[fadeInUp_0.15s_ease]"
        >
          <div className="flex items-center gap-1.5 font-bold text-[12.5px] text-[var(--ink-text)] border-b border-[var(--ink-border)] pb-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-accent)] shrink-0" />
            <span>{title}</span>
          </div>
          <div className="text-[11.5px] text-[var(--ink-text-muted)] whitespace-pre-line leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </span>
  )
}
