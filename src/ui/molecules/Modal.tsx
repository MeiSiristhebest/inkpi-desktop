import React, { type ReactNode } from 'react'

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
 * 只负责遮罩层 + 居中卡片外壳 + 点击遮罩关闭；卡片内部的具体结构
 * （标题栏 / 操作条 / 主体 / 页脚）由各模态自行组合，保留其既有布局差异。
 * 抽离后消除 SensitiveModal / OveruseWordsModal / HistoryModal / LockModal 重复的遮罩与卡片外壳（§10/§11）。
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  widthClass = 'max-w-lg',
  overlayClassName = 'bg-black/40 backdrop-blur-sm',
  panelClassName = 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--ink-text)]',
  closeOnBackdrop = true,
}) => (
  <div
    className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName} p-4 select-none`}
    onClick={(e) => {
      if (closeOnBackdrop && e.target === e.currentTarget) onClose()
    }}
  >
    <div className={`w-full ${widthClass} ${panelClassName}`}>{children}</div>
  </div>
)
