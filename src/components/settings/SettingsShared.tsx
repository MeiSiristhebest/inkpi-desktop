import { motion, AnimatePresence } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { spring, gesture, variants } from '../../motion'

// ── 排版常量（所有设置页共用，不得私造）─────────────────────────────────────
export const fieldLabel = 'text-[11.5px] font-medium text-[var(--ink-text-faint)] mb-1.5'

export const inputCls =
  'w-full px-3 py-2 rounded-lg text-[13px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] transition-colors duration-150'

export const segBase = 'px-3 py-1.5 rounded-lg text-[12.5px] cursor-pointer'
export const segActive = 'bg-[var(--ink-accent)] text-white shadow-2xs font-medium'
export const segIdle = 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'

// ── Section ───────────────────────────────────────────────────────────────────
export interface SectionProps {
  title: string
  desc?: string
  children: ReactNode
}

export const Section = ({ title, desc, children }: SectionProps) => (
  <section className="space-y-2.5">
    <div className="px-1">
      <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">{title}</h3>
      {desc && (
        <p className="text-[12px] text-[var(--ink-text-faint)] mt-0.5 leading-relaxed">{desc}</p>
      )}
    </div>
    <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] divide-y divide-[var(--ink-border)] overflow-hidden shadow-2xs">
      {children}
    </div>
  </section>
)

// ── Row ───────────────────────────────────────────────────────────────────────
export interface RowProps {
  label: string
  hint?: string
  children: ReactNode
}

export const Row = ({ label, hint, children }: RowProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3.5">
    <div className="min-w-0 flex-1 sm:pr-4">
      <div className="text-[13px] text-[var(--ink-text)] font-medium">{label}</div>
      {hint && (
        <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5 leading-relaxed">
          {hint}
        </div>
      )}
    </div>
    <div className="shrink-0 flex items-center sm:justify-end w-full sm:w-auto">{children}</div>
  </div>
)

// ── Segmented ─────────────────────────────────────────────────────────────────
// 使用 motion 的 layoutId 实现选中指示器的平滑滑动（自动隔离实例，避免跨组件乱飞）
// ARIA: role="radiogroup" + role="radio" + ArrowLeft/ArrowRight navigation
export interface SegmentedProps<T extends string | number> {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
  layoutId?: string
  /** Accessible label for the radiogroup */
  ariaLabel?: string
}

export const Segmented = <T extends string | number>({
  value,
  options,
  onChange,
  layoutId,
  ariaLabel,
}: SegmentedProps<T>) => {
  const autoId = useId()
  const activeLayoutId = layoutId || `segmented-active-${autoId}`

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex((o) => o.v === value)
    if (currentIndex === -1) return
    let nextIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % options.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = options.length - 1
    }
    if (nextIndex !== currentIndex) {
      onChange(options[nextIndex].v)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex flex-wrap gap-0 p-1 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] max-w-full"
      onKeyDown={handleKeyDown}
    >
      {options.map((o) => {
        const isActive = value === o.v
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(o.v)}
            className={`relative z-10 ${segBase} ${isActive ? 'text-white font-medium' : segIdle}`}
          >
            {/* 滑动背景块：使用唯一的 layoutId，杜绝不同分段控制器之间的 layout 飞跃 */}
            {isActive && (
              <motion.span
                layoutId={activeLayoutId}
                className="absolute inset-0 rounded-lg bg-[var(--ink-accent)] shadow-2xs"
                style={{ zIndex: -1 }}
                transition={spring.snappy}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Slider ────────────────────────────────────────────────────────────────────
// ARIA: native <input type="range"> already provides role="slider" + arrow-key support.
// We add explicit aria-label and aria-valuetext for screen-reader clarity.
export interface SliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  /** Accessible label for the slider */
  ariaLabel?: string
  /** Custom value text (e.g. "50%") shown to screen readers */
  ariaValueText?: string
}

export const Slider = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
  ariaValueText,
}: SliderProps) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    aria-label={ariaLabel}
    aria-valuetext={ariaValueText ?? String(value)}
    className="w-48 sm:w-56 accent-[var(--ink-accent)] cursor-pointer"
  />
)

// ── Switch ────────────────────────────────────────────────────────────────────
// 真正的 motion 弹簧驱动：底座颜色 + 圆形滑块位移均有物理弹簧
// ARIA: role="switch" + aria-checked toggled by Space/Enter (native button behavior)
export interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  /** Accessible label for the switch */
  ariaLabel?: string
  /** Visible label text rendered next to the switch */
  label?: string
}

export const Switch = ({ checked, onChange, ariaLabel, label }: SwitchProps) => (
  <div className="inline-flex items-center gap-2">
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      {...gesture.button}
      className={`relative w-10 h-5.5 rounded-full cursor-pointer select-none flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] ${checked ? 'bg-[var(--ink-accent)]' : 'bg-[var(--ink-border-strong)]'}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <motion.span
        animate={{ x: checked ? 18 : 0 }}
        transition={spring.snappy}
        className="absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-xs"
      />
    </motion.button>
    {label && <span className="text-[12.5px] text-[var(--ink-text)] select-none">{label}</span>}
  </div>
)

// ── PrimaryButton ─────────────────────────────────────────────────────────────
export interface PrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const PrimaryButton = ({
  children,
  onClick,
  disabled,
  className = '',
}: PrimaryButtonProps) => (
  <motion.button
    type="button"
    onClick={onClick}
    disabled={disabled}
    {...gesture.button}
    transition={spring.snappy}
    className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 ${className}`}
  >
    {children}
  </motion.button>
)

// ── SecondaryButton ───────────────────────────────────────────────────────────
export interface SecondaryButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const SecondaryButton = ({
  children,
  onClick,
  disabled,
  className = '',
}: SecondaryButtonProps) => (
  <motion.button
    type="button"
    onClick={onClick}
    disabled={disabled}
    {...gesture.button}
    transition={spring.snappy}
    className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 ${className}`}
  >
    {children}
  </motion.button>
)

// ── FadePresence ──────────────────────────────────────────────────────────────
export interface FadePresenceProps {
  show: boolean
  children: ReactNode
}

export const FadePresence = ({ show, children }: FadePresenceProps) => (
  <AnimatePresence>
    {show && (
      <motion.div {...variants.fadeUp} transition={spring.gentle}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)
