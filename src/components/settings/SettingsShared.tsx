import type { FC, ReactNode } from 'react'

export const Section: FC<{ title: string; desc?: string; children: ReactNode }> = ({
  title,
  desc,
  children,
}) => (
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

export const Row: FC<{ label: string; hint?: string; children: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
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

export const Switch: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-5.5 rounded-full transition-colors duration-150 cursor-pointer ${
      checked ? 'bg-[var(--ink-accent)]' : 'bg-[var(--ink-border-strong)]'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform duration-150 shadow-xs ${
        checked ? 'translate-x-4.5' : ''
      }`}
    />
  </button>
)
