import { useState, type FC, useEffect } from 'react'
import { Check, X, Edit2, AlertCircle, Quote, HelpCircle, GitMerge } from 'lucide-react'
import type { DistillationItem } from '../../ai/proposals/distillationReviewInbox'

interface DistillationInboxModalProps {
  items: DistillationItem[]
  onAccept: (itemId: string, overrides?: { name?: string; summary?: string }) => Promise<void>
  onKeepHypothesis?: (itemId: string) => Promise<void>
  onMerge?: (itemId: string) => Promise<void>
  onReject: (itemId: string) => void | Promise<void>
  onClose: () => void
}

export const DistillationInboxModal: FC<DistillationInboxModalProps> = ({
  items,
  onAccept,
  onKeepHypothesis,
  onMerge,
  onReject,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Esc closes the dialog
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleStartEdit = (item: DistillationItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditSummary(item.summary)
  }

  const handleSaveAndAccept = async (itemId: string) => {
    try {
      setProcessingId(itemId)
      await onAccept(itemId, {
        name: editName.trim() || undefined,
        summary: editSummary.trim() || undefined,
      })
      setEditingId(null)
    } catch (e) {
      console.error('Failed to accept item:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDirectAccept = async (itemId: string) => {
    try {
      setProcessingId(itemId)
      await onAccept(itemId)
    } catch (e) {
      console.error('Failed to accept item:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleHypothesis = async (itemId: string) => {
    if (!onKeepHypothesis) return
    try {
      setProcessingId(itemId)
      await onKeepHypothesis(itemId)
    } catch (e) {
      console.error('Failed to keep hypothesis:', e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMerge = async (itemId: string) => {
    if (!onMerge) return
    try {
      setProcessingId(itemId)
      await onMerge(itemId)
    } catch (e) {
      console.error('Failed to merge item:', e)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div
      data-testid="distillation-inbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="distillation-inbox-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div
        data-testid="distillation-inbox-modal"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ink-border)]">
          <div>
            <h2 id="distillation-inbox-title" className="text-[15px] font-semibold text-[var(--ink-text)]">
              AI 事实提炼审查箱 (Distillation Review Inbox)
            </h2>
            <p className="text-[12px] text-[var(--ink-text-muted)] mt-0.5">
              审查从章节中提取的新事实、时空事件与伏笔。采纳后将作为权威事实落库并升级正史溯源。
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content / List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-text-faint)]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">暂无待审查的 AI 提炼事实</p>
            </div>
          ) : (
            items.map((item) => {
              const isEditing = editingId === item.id
              const isProcessing = processingId === item.id

              return (
                <div
                  key={item.id}
                  data-testid={`distill-item-${item.id}`}
                  className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] uppercase">
                          {item.category === 'entity'
                            ? `实体 · ${item.kind || '通用'}`
                            : item.category === 'event'
                              ? `事件 · ${item.kind || '时空'}`
                              : '伏笔线索'}
                        </span>
                        <span className="text-[11px] text-[var(--ink-text-muted)]">
                          置信度 {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)] text-[var(--ink-text)]"
                            placeholder="设定名称"
                          />
                          <textarea
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            rows={2}
                            className="w-full px-2.5 py-1.5 rounded-md text-[12px] bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)] text-[var(--ink-text)]"
                            placeholder="设定概要"
                          />
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <h4 className="text-[14px] font-medium text-[var(--ink-text)]">
                            {item.name}
                          </h4>
                          <p className="text-[12px] text-[var(--ink-text-muted)] mt-0.5 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveAndAccept(item.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            保存并采纳
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(item)}
                            title="编辑"
                            aria-label="编辑"
                            className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onKeepHypothesis && item.category === 'entity' && (
                            <button
                              onClick={() => void handleHypothesis(item.id)}
                              disabled={isProcessing}
                              title="保留为推测 (非正典)"
                              aria-label="保留为推测"
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onMerge && item.category === 'entity' && (
                            <button
                              onClick={() => void handleMerge(item.id)}
                              disabled={isProcessing}
                              title="合并到已有实体"
                              aria-label="合并已有实体"
                              className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => void onReject(item.id)}
                            title="拒绝"
                            aria-label="拒绝"
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void handleDirectAccept(item.id)}
                            disabled={isProcessing}
                            title="采纳为正史"
                            aria-label="采纳"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            采纳
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Original evidence snippet */}
                  {item.evidence && item.evidence.length > 0 && item.evidence[0].excerpt && (
                    <div className="pt-2 border-t border-[var(--ink-border)] flex items-start gap-1.5 text-[11px] text-[var(--ink-text-muted)] bg-[var(--ink-bg-panel)]/50 p-2 rounded-lg">
                      <Quote className="w-3 h-3 shrink-0 text-[var(--ink-accent)] mt-0.5 opacity-70" />
                      <span className="italic">“{item.evidence[0].excerpt}”</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[12px] text-[var(--ink-text-muted)]">
          <span>共 {items.length} 条待审查事实</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
