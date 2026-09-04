import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** 正文内容（可为多段 / 富文本节点） */
  children?: ReactNode
  confirmText?: string
  cancelText?: string
  /** 危险操作：确认按钮使用 --ink-danger 配色 */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 通用二次确认弹窗（原子设计 · molecules）。
 * 复用 Modal 外壳，沉淀「标题 + 提示正文 + 取消/确认」的标准交互（§10/§11）。
 * 危险操作通过 danger 走唯一的 --ink-danger 强调色。
 */
export const ConfirmDialog = ({
  open,
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!open) return null
  return (
    <Modal onClose={onCancel} widthClass="max-w-[400px]">
      <div
        className="px-5 py-3.5 border-b border-[var(--ink-border)] flex items-center justify-between bg-[var(--ink-bg-panel)]"
        role="alertdialog"
        aria-modal="true"
      >
        <h2 className="text-[14px] font-medium text-[var(--ink-text)] flex items-center gap-2">
          {danger && <AlertTriangle className="w-4 h-4 text-[var(--ink-danger)]" />}
          {title}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] text-xs cursor-pointer p-1"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="p-5 space-y-3">
        {children}
        <div className="flex gap-2.5 pt-3">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-xl text-[12.5px] border border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-opacity cursor-pointer shadow-xs ${
              danger
                ? 'bg-[var(--ink-danger)] hover:opacity-90 text-white'
                : 'bg-[var(--ink-accent)] hover:bg-[var(--ink-accent-hover)] text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
