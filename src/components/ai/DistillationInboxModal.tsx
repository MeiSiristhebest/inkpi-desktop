import { useState, type FC, useId, useRef } from 'react'
import { Check, X, Edit2, AlertCircle, Quote, HelpCircle, GitMerge } from 'lucide-react'
import { Modal } from '../../ui/molecules/Modal'
import type {
  DistillationAcceptOverrides,
  DistillationItem,
} from '../../ai/proposals/distillationReviewInbox'
import { Tooltip } from '../../ui/primitives'
import type { ChapterRecord } from '../../types'
import type {
  SourceNavigationRequest,
  SourceNavigationResult,
} from '../../core/activeWritingContext'

interface DistillationInboxModalProps {
  items: DistillationItem[]
  onAccept: (itemId: string, overrides?: DistillationAcceptOverrides) => Promise<void>
  onKeepHypothesis?: (itemId: string) => Promise<void>
  onMerge?: (itemId: string) => Promise<void>
  onReject: (itemId: string) => void | Promise<void>
  onClose: () => void
  sourceChapters?: readonly (Pick<ChapterRecord, 'id' | 'revision'> & { title?: string })[]
  onOpenSource?: (request: SourceNavigationRequest) => Promise<SourceNavigationResult>
}

export const DistillationInboxModal: FC<DistillationInboxModalProps> = ({
  items,
  onAccept,
  onKeepHypothesis,
  onMerge,
  onReject,
  onClose,
  sourceChapters,
  onOpenSource,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const actionInFlight = useRef(false)
  const [actionError, setActionError] = useState<{ itemId: string; message: string } | null>(null)
  const [chapterChoices, setChapterChoices] = useState<Record<string, string>>({})
  const [sourceNavigationMessage, setSourceNavigationMessage] = useState<{
    itemId: string
    message: string
  } | null>(null)
  const titleId = useId()

  const handleOpenSource = async (itemId: string, request: SourceNavigationRequest) => {
    if (!onOpenSource || actionInFlight.current) return
    actionInFlight.current = true
    setProcessingId(itemId)
    setSourceNavigationMessage(null)
    let closeAfterNavigation = false
    try {
      const result = await onOpenSource(request)
      if (result.status === 'opened' && result.highlighted) {
        closeAfterNavigation = true
      } else if (result.status === 'opened') {
        setSourceNavigationMessage({
          itemId,
          message: '已打开来源章节，但原文引用已变更或不唯一，请按下方摘录核对。',
        })
      } else if (result.status === 'save-blocked') {
        setSourceNavigationMessage({
          itemId,
          message: '当前稿件未能保存，无法切换章节。请先处理保存提示。',
        })
      } else if (result.status === 'not-found') {
        setSourceNavigationMessage({ itemId, message: '来源章节已不存在。' })
      } else {
        setSourceNavigationMessage({ itemId, message: '请先打开正文编辑器，再查看原文。' })
      }
    } catch {
      setSourceNavigationMessage({ itemId, message: '打开来源章节失败，请重试。' })
    } finally {
      actionInFlight.current = false
      if (!closeAfterNavigation) setProcessingId(null)
    }
    if (closeAfterNavigation) {
      setProcessingId(null)
      onClose()
    }
  }

  const handleStartEdit = (item: DistillationItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditSummary(item.summary)
  }

  const runReviewAction = async (
    itemId: string,
    label: string,
    action: () => void | Promise<void>,
  ) => {
    if (actionInFlight.current) return false
    actionInFlight.current = true
    setActionError(null)
    try {
      setProcessingId(itemId)
      await action()
      return true
    } catch (error) {
      setActionError({
        itemId,
        message: `${label}失败：${error instanceof Error ? error.message : '操作未完成'}。请重试。`,
      })
      return false
    } finally {
      actionInFlight.current = false
      setProcessingId(null)
    }
  }

  const handleSaveAndAccept = async (itemId: string) => {
    const succeeded = await runReviewAction(itemId, '采纳', () =>
      onAccept(itemId, {
        name: editName.trim() || undefined,
        summary: editSummary.trim() || undefined,
        ...(chapterChoices[itemId] ? { chapterId: chapterChoices[itemId] } : {}),
      }),
    )
    if (succeeded) setEditingId(null)
  }

  const handleDirectAccept = (itemId: string) => {
    return runReviewAction(itemId, '采纳', () =>
      chapterChoices[itemId]
        ? onAccept(itemId, { chapterId: chapterChoices[itemId] })
        : onAccept(itemId),
    )
  }

  const handleHypothesis = (itemId: string) => {
    if (!onKeepHypothesis) return
    return runReviewAction(itemId, '保留推测', () => onKeepHypothesis(itemId))
  }

  const handleMerge = (itemId: string) => {
    if (!onMerge) return
    return runReviewAction(itemId, '打开合并', () => onMerge(itemId))
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy={titleId}
      widthClass="max-w-2xl"
      panelClassName="bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--ink-text)]"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ink-border)] shrink-0">
        <div>
          <h2 id={titleId} className="text-[15px] font-semibold text-[var(--ink-text)]">
            AI 事实提炼审查箱 (Distillation Review Inbox)
          </h2>
          <p className="text-[12px] text-[var(--ink-text-muted)] mt-0.5">
            审查从章节中提取的新事实、时空事件与伏笔。采纳后将作为权威事实落库并升级正史溯源。
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
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
            const isBusy = processingId !== null
            const sourceDocumentId = item.sourceDocumentId ?? item.evidence?.[0]?.documentId
            const sourceBlockId = item.sourceBlockId ?? item.evidence?.[0]?.blockId
            const sourceEvidence =
              item.evidence?.find((evidence) => evidence.documentId === sourceDocumentId) ??
              item.evidence?.[0]
            const sourceChapter = sourceChapters?.find((chapter) => chapter.id === sourceDocumentId)
            const sourceIsMissing =
              Boolean(sourceDocumentId) && Boolean(sourceChapters) && !sourceChapter
            const sourceIsStale =
              Boolean(sourceChapter) &&
              item.sourceRevision !== undefined &&
              item.sourceRevision !== (sourceChapter?.revision ?? 0)
            const sourceNavigationRequest: SourceNavigationRequest | undefined = sourceDocumentId
              ? {
                  documentId: sourceDocumentId,
                  ...(sourceBlockId ? { blockId: sourceBlockId } : {}),
                  ...(item.sourceRevision !== undefined
                    ? { sourceRevision: item.sourceRevision }
                    : {}),
                  ...(sourceEvidence?.excerpt ? { excerpt: sourceEvidence.excerpt } : {}),
                  ...(sourceEvidence?.semanticFrom !== undefined
                    ? { semanticFrom: sourceEvidence.semanticFrom }
                    : {}),
                  ...(sourceEvidence?.semanticTo !== undefined
                    ? { semanticTo: sourceEvidence.semanticTo }
                    : {}),
                }
              : undefined

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
                          disabled={isBusy}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)] text-[var(--ink-text)]"
                          placeholder="设定名称"
                        />
                        <textarea
                          disabled={isBusy}
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
                          disabled={isBusy}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          保存并采纳
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isBusy}
                          className="px-2 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <Tooltip content="编辑">
                          <button
                            onClick={() => handleStartEdit(item)}
                            disabled={isBusy}
                            aria-label="编辑"
                            className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        {onKeepHypothesis && item.category === 'entity' && (
                          <Tooltip content="保留为推测 (非正典)">
                            <button
                              onClick={() => void handleHypothesis(item.id)}
                              disabled={isBusy}
                              aria-label="保留为推测"
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        )}
                        {onMerge && item.category === 'entity' && (
                          <Tooltip content="合并到已有实体">
                            <button
                              onClick={() => void handleMerge(item.id)}
                              disabled={isBusy}
                              aria-label="合并已有实体"
                              className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip content="拒绝">
                          <button
                            onClick={() =>
                              void runReviewAction(item.id, '拒绝', () => onReject(item.id))
                            }
                            disabled={isBusy}
                            aria-label="拒绝"
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="采纳为正史">
                          <button
                            onClick={() => void handleDirectAccept(item.id)}
                            disabled={isBusy}
                            aria-label="采纳"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            采纳
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>

                {item.category !== 'entity' && !sourceChapter && (
                  <div className="text-[12px] text-[var(--ink-text-muted)] space-y-1">
                    <p>没有可用的来源章节，采纳后暂不指定章节；你可以选择其章节位置。</p>
                    <select
                      aria-label={`${item.name}的章节位置`}
                      value={chapterChoices[item.id] ?? ''}
                      disabled={isBusy}
                      onChange={(event) =>
                        setChapterChoices((choices) => ({
                          ...choices,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] px-2 py-1 text-[var(--ink-text)]"
                    >
                      <option value="">暂不指定章节</option>
                      {sourceChapters?.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title || chapter.id}
                        </option>
                      ))}
                    </select>
                    <p>章节位置不作为原文出处。</p>
                  </div>
                )}
                {actionError?.itemId === item.id && (
                  <p role="alert" className="text-[12px] text-red-500">
                    {actionError.message}
                  </p>
                )}

                {/* Original evidence snippet */}
                <div className="pt-2 border-t border-[var(--ink-border)] text-[10px] text-[var(--ink-text-muted)]">
                  {sourceDocumentId ? (
                    <span>
                      来源：文档 {sourceDocumentId}
                      {sourceBlockId ? ` · 段落 ${sourceBlockId}` : ''}
                      {item.sourceRevision !== undefined ? ` · 修订 ${item.sourceRevision}` : ''}
                    </span>
                  ) : (
                    <span>尚无已核对的原文出处</span>
                  )}
                  {sourceIsStale && (
                    <p role="status" className="mt-1 text-amber-500">
                      原文已变更：当前修订 {sourceChapter?.revision ?? 0}，出处来自修订{' '}
                      {item.sourceRevision}。
                    </p>
                  )}
                  {sourceIsMissing && (
                    <p role="status" className="mt-1 text-amber-500">
                      来源章节已删除，无法跳转。
                    </p>
                  )}
                </div>
                {item.evidence && item.evidence.length > 0 && item.evidence[0].excerpt && (
                  <div className="flex items-start gap-1.5 text-[11px] text-[var(--ink-text-muted)] bg-[var(--ink-bg-panel)]/50 p-2 rounded-lg">
                    <Quote className="w-3 h-3 shrink-0 text-[var(--ink-accent)] mt-0.5 opacity-70" />
                    <span className="italic">“{item.evidence[0].excerpt}”</span>
                  </div>
                )}
                {sourceNavigationRequest && onOpenSource && !sourceIsMissing && (
                  <button
                    type="button"
                    aria-label={`查看原文：${item.name}`}
                    disabled={isBusy}
                    onClick={() => void handleOpenSource(item.id, sourceNavigationRequest)}
                    className="text-[11px] text-[var(--ink-accent)] hover:underline disabled:opacity-50"
                  >
                    {isProcessing ? '正在打开…' : '查看原文'}
                  </button>
                )}
                {sourceNavigationMessage?.itemId === item.id && (
                  <p role="alert" className="text-[11px] text-amber-500">
                    {sourceNavigationMessage.message}
                  </p>
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
    </Modal>
  )
}
