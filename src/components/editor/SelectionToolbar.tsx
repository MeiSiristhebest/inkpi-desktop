import { useEffect, useRef, useState, type RefObject } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bold, Italic, Wand2, Anchor, CheckCircle2, Sparkles } from 'lucide-react'
import { spring, variants, gesture } from '../../motion'
import { useOptionalPluginHostContext } from '../../core/pluginHostContext'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { createRewriteTask } from '../../ai'
import type { SemanticDocument } from '../../domain/content'
import {
  semanticDocumentFromProseMirror,
  semanticDocumentFromText,
  applySemanticPatchesToHtml,
} from '../../domain/content'
import {
  hashText,
  IndexedDbProposalStore,
  ProposalConflictError,
  ProposalLedger,
  proposalFromPatch,
  ProposalChapterUnitOfWork,
  type AiProposal,
} from '../../ai/proposals'
import { idGenerator } from '../../adapters/idGenerator'
import type { ProposalSyncRemote } from '../../adapters/daemonDomainSyncRemote'
import { getProposalSyncRemote, isProposalSyncError, RemoteProposalStore } from '../../ai/proposals'
import { proposalStateEvents, type ProposalEventScope } from '../../ports/proposalStateEvents'
import { Tooltip } from '../../ui/primitives'

interface SelectionToolbarProps {
  /** TipTap 编辑器实例（任意结构，仅在具备 on/off/view 时生效） */
  editor: any
  /** 承载编辑器的可滚动容器（position: relative），用于把选区坐标换算为工具条定位 */
  containerRef: RefObject<HTMLElement | null>
  /** 划词润色：通过统一任务运行时创建 patch proposal */
  onAiTask?: (task: AiTask) => Promise<TaskResult | null>
  /** 打开 AI 副驾驶面板 */
  onOpenAssistant?: () => void
  /** 当前章节 id，随润色请求一并上报 */
  activeChapterId?: string
  /** 当前章节版本，用于 Proposal 的 CAS 校验 */
  activeChapterRevision?: number
  /** projectId/workspaceId scopes the daemon's derived proposal projection */
  workspaceId?: string
  /** Optional direct daemon projection capability; task results provide the production fallback. */
  proposalSyncRemote?: ProposalSyncRemote
}

interface ToolbarState {
  show: boolean
  top: number
  left: number
}

interface RewriteProposalState {
  proposal: AiProposal
  originalText: string
  proposedText: string
  status: AiProposal['status']
  error?: string
}

interface RewriteRequestAnchor {
  context: { workspaceId: string; chapterId: string; revision: number }
  document: SemanticDocument
  selection: { from: number; to: number }
  sourceHash: string
}

const DEFAULT_REWRITE_GOAL = '保持事实和原意，改进选中文本'

/**
 * 自绘选区浮动工具条，完全替代 tippy.js 版 BubbleMenu。
 *
 * 为何要替换：@tiptap/react 的 BubbleMenu 基于 tippy.js，会把菜单 <div>
 * 从 React 树内挪到 document.body，导致组件卸载时 React 在 commit 阶段
 * 找不到原父节点而抛 `insertBefore`/`removeChild` 错误 → 整页白屏。
 * 本组件只渲染在 React 树内（容器内部 absolute 定位），不挪动任何 DOM，
 * 因此卸载时干净、不会触发该冲突。
 */
export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  editor,
  containerRef,
  onAiTask,
  onOpenAssistant,
  activeChapterId,
  activeChapterRevision = 0,
  workspaceId,
  proposalSyncRemote,
}) => {
  const host = useOptionalPluginHostContext()
  const [state, setState] = useState<ToolbarState>({ show: false, top: 0, left: 0 })
  const [rewriteProposal, setRewriteProposal] = useState<RewriteProposalState | null>(null)
  const rewriteProposalRef = useRef<RewriteProposalState | null>(null)
  const [rewriteBusy, setRewriteBusy] = useState(false)
  const [rewriteComposerOpen, setRewriteComposerOpen] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const rewriteRequestGenerationRef = useRef(0)
  const rewriteComposerAnchorRef = useRef<RewriteRequestAnchor | null>(null)
  const lastRewriteRequestRef = useRef<{ anchor: RewriteRequestAnchor; goal: string } | null>(null)
  const explicitProposalSyncRemoteRef = useRef(proposalSyncRemote)
  const taskProposalSyncRemoteRef = useRef<ProposalSyncRemote | undefined>(undefined)
  const initialWorkspaceId = normalizeScopeId(workspaceId) ?? normalizeScopeId(host?.projectId)
  const initialProjectId = normalizeScopeId(host?.projectId) ?? initialWorkspaceId
  const activeContext = {
    workspaceId: initialProjectId || '',
    chapterId: activeChapterId || 'selection',
    revision: activeChapterRevision,
  }
  const activeContextRef = useRef(activeContext)
  const previousContext = activeContextRef.current
  if (
    previousContext.workspaceId !== activeContext.workspaceId ||
    previousContext.chapterId !== activeContext.chapterId ||
    previousContext.revision !== activeContext.revision
  ) {
    rewriteRequestGenerationRef.current += 1
  }
  activeContextRef.current = activeContext
  useEffect(() => {
    setRewriteBusy(false)
    setRewriteComposerOpen(false)
    setRewriteInstruction('')
    setRewriteError(null)
    rewriteComposerAnchorRef.current = null
    lastRewriteRequestRef.current = null
  }, [activeContext.workspaceId, activeContext.chapterId, activeContext.revision])
  const proposalScope: ProposalEventScope | undefined = initialWorkspaceId
    ? {
        workspaceId: initialWorkspaceId,
        ...(initialProjectId === undefined ? {} : { projectId: initialProjectId }),
      }
    : undefined
  const proposalScopeRef = useRef<ProposalEventScope | undefined>(proposalScope)
  const scopedWorkspaceId = proposalScope?.workspaceId.trim()
  const [proposalLedger] = useState(() => {
    const localStore = new IndexedDbProposalStore()
    if (!scopedWorkspaceId) return new ProposalLedger({ store: localStore })
    return new ProposalLedger({
      eventScope: proposalScope,
      store: new RemoteProposalStore({
        local: localStore,
        workspaceId: scopedWorkspaceId,
        remote: () => explicitProposalSyncRemoteRef.current ?? taskProposalSyncRemoteRef.current,
      }),
    })
  })

  useEffect(() => {
    rewriteProposalRef.current = rewriteProposal
    explicitProposalSyncRemoteRef.current = proposalSyncRemote
  }, [proposalSyncRemote, rewriteProposal])

  useEffect(() => {
    if (
      !editor ||
      !editor.view ||
      typeof editor.on !== 'function' ||
      typeof editor.off !== 'function'
    ) {
      return
    }

    const hide = () => {
      setState((s) => (s.show ? { ...s, show: false } : s))
    }

    const compute = () => {
      const { from, to } = editor.state.selection
      if (from === to) {
        hide()
        return
      }
      const text = editor.state.doc.textBetween(from, to, ' ')
      if (!text.trim()) {
        hide()
        return
      }
      try {
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const canvas = containerRef.current
        if (!canvas) {
          hide()
          return
        }
        const crect = canvas.getBoundingClientRect()
        // 容器可滚动：absolute 子元素随内容滚动，故用「内容坐标」= 视口偏移 + scrollTop
        const top = start.top - crect.top + canvas.scrollTop - 44
        const left = (start.left + end.left) / 2 - crect.left
        setState({ show: true, top, left })
      } catch {
        // jsdom 无布局信息 / 选区临时不可用，忽略
        hide()
      }
    }

    editor.on('selectionUpdate', compute)
    editor.on('transaction', compute)
    editor.on('blur', hide)
    editor.on('focus', compute)

    return () => {
      editor.off('selectionUpdate', compute)
      editor.off('transaction', compute)
      editor.off('blur', hide)
      editor.off('focus', compute)
    }
  }, [editor, containerRef])

  useEffect(() => {
    const scope = proposalScopeRef.current
    if (!scope) return

    let disposed = false
    const unsubscribe = proposalStateEvents.subscribe(scope, (event) => {
      const current = rewriteProposalRef.current
      if (!current || current.proposal.id !== event.proposalId) return

      void proposalLedger
        .reload()
        .then(() => {
          if (disposed) return
          const next = proposalLedger.get(event.proposalId)
          if (!next) return
          setRewriteProposal((value) => {
            if (!value || value.proposal.id !== next.id) return value
            // 如果本地已有活跃错误或本地已被标记为冲突 (stale)，且远程并未推进到终态（committed/undone/rejected），则保留本地错误与冲突状态
            if (value.error && next.status === 'accepted') return value

            const nextPatch = next.patches[0]
            return {
              ...value,
              proposal: next,
              proposedText: nextPatch?.text ?? value.proposedText,
              status: next.status,
              error:
                next.status === 'stale'
                  ? '提案与其他窗口的修改冲突，请重新审阅当前内容'
                  : undefined,
            }
          })
        })
        .catch((error: unknown) => {
          if (disposed) return
          setRewriteProposal((value) =>
            value && value.proposal.id === event.proposalId
              ? {
                  ...value,
                  error: `跨窗口刷新提案失败：${error instanceof Error ? error.message : String(error)}`,
                }
              : value,
          )
        })
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [proposalLedger])

  const currentDocumentId = activeChapterId || 'selection'
  const currentRewriteProposal =
    rewriteProposal?.proposal.documentId === currentDocumentId ? rewriteProposal : null
  if (
    (!state.show && !currentRewriteProposal && !rewriteComposerOpen && !rewriteError) ||
    !editor
  ) {
    return null
  }

  const currentSemanticDocument = () =>
    typeof editor.state?.doc?.toJSON === 'function'
      ? semanticDocumentFromProseMirror(
          activeChapterId || 'selection',
          editor.state.doc.toJSON(),
          activeChapterRevision,
        )
      : semanticDocumentFromText(
          activeChapterId || 'selection',
          editor.getText?.() || '',
          activeChapterRevision,
        )

  const captureRewriteAnchor = (): RewriteRequestAnchor | null => {
    const range = editor.state?.selection
    if (!range || range.from === range.to) return null
    const selectedText = editor.state.doc.textBetween(range.from, range.to, ' ')
    if (!selectedText?.trim()) return null
    const document = currentSemanticDocument()
    return {
      context: { ...activeContextRef.current },
      document,
      selection: document.sourceMap.editorRangeToSemantic({ from: range.from, to: range.to }),
      sourceHash: hashText(document.text),
    }
  }

  const rewriteAnchorIsCurrent = (anchor: RewriteRequestAnchor): boolean => {
    const latestContext = activeContextRef.current
    return (
      latestContext.workspaceId === anchor.context.workspaceId &&
      latestContext.chapterId === anchor.context.chapterId &&
      latestContext.revision === anchor.context.revision &&
      hashText(currentSemanticDocument().text) === anchor.sourceHash
    )
  }

  const openRewriteComposer = () => {
    const anchor = captureRewriteAnchor()
    if (!anchor) {
      setRewriteError('请先选中需要修改的文字。')
      return
    }
    rewriteComposerAnchorRef.current = anchor
    lastRewriteRequestRef.current = null
    setRewriteInstruction('')
    setRewriteError(null)
    setRewriteComposerOpen(true)
  }

  const cancelRewriteComposer = () => {
    if (rewriteBusy) return
    setRewriteComposerOpen(false)
    setRewriteInstruction('')
    setRewriteError(null)
    rewriteComposerAnchorRef.current = null
  }

  const runRewrite = async (goal: string, requestedAnchor: RewriteRequestAnchor | null = null) => {
    if (!onAiTask || rewriteBusy) return
    const anchor = requestedAnchor ?? rewriteComposerAnchorRef.current ?? captureRewriteAnchor()
    if (!anchor) {
      setRewriteError('请先选中需要修改的文字。')
      return
    }
    if (!rewriteAnchorIsCurrent(anchor)) {
      setRewriteError('选区内容或章节已变化，请重新选择后生成。')
      return
    }

    const requestGeneration = ++rewriteRequestGenerationRef.current
    lastRewriteRequestRef.current = { anchor, goal }
    setRewriteBusy(true)
    setRewriteError(null)
    try {
      const result = await onAiTask(
        createRewriteTask({
          taskId: idGenerator.generate(`rewrite-${anchor.context.chapterId || 'selection'}`),
          workspaceId: anchor.context.workspaceId,
          document: anchor.document,
          selection: anchor.selection,
          goal,
          metadata: { source: 'selection-toolbar', sourceHash: anchor.sourceHash },
        }),
      )
      if (requestGeneration !== rewriteRequestGenerationRef.current) return
      if (!result) throw new Error('AI 没有返回建议。请重试。')
      if (!rewriteAnchorIsCurrent(anchor)) {
        throw new Error('选区内容或章节已变化，已丢弃过期建议。请重新选择后生成。')
      }
      const resultRemote = getProposalSyncRemote(result)
      if (resultRemote) taskProposalSyncRemoteRef.current = resultRemote
      const proposal = proposalFromPatch(result, {
        id: `proposal-${result.taskId}`,
        documentId: anchor.document.documentId,
        baseRevision: anchor.context.revision,
        sourceHash: anchor.sourceHash,
      })
      const patch = proposal.patches[0]
      if (patch.from < anchor.selection.from || patch.to > anchor.selection.to) {
        throw new Error('Rewrite proposal must stay within the selected semantic range')
      }
      proposalLedger.create(proposal)
      setRewriteComposerOpen(false)
      setRewriteError(null)
      setRewriteProposal({
        proposal,
        originalText: anchor.document.text.slice(patch.from, patch.to),
        proposedText: patch.text,
        status: 'pending',
      })
    } catch (error) {
      if (requestGeneration !== rewriteRequestGenerationRef.current) return
      setRewriteError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestGeneration === rewriteRequestGenerationRef.current) setRewriteBusy(false)
    }
  }

  const aiPolish = () => void runRewrite(DEFAULT_REWRITE_GOAL, captureRewriteAnchor())

  const submitRewrite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runRewrite(
      rewriteInstruction.trim() || DEFAULT_REWRITE_GOAL,
      rewriteComposerAnchorRef.current,
    )
  }

  const retryRewrite = () => {
    const request = lastRewriteRequestRef.current
    if (!request) {
      setRewriteError('没有可重试的请求，请重新选择文本后生成。')
      return
    }
    void runRewrite(request.goal, request.anchor)
  }

  const commitRewrite = async () => {
    if (!rewriteProposal || rewriteProposal.status !== 'pending') return
    const proposal = rewriteProposal.proposal
    if (proposal.documentId !== currentDocumentId) return
    const current = currentSemanticDocument()
    const targetWorkspaceId = initialProjectId || ''
    const targetChapterId = proposal.documentId

    const originalHtml = editor.getHTML?.() ?? editor.getText?.() ?? current.text

    try {
      proposalLedger.accept(proposal.id)
      await proposalLedger.flush().catch(() => {})

      // 1. 在影子文档（HTML / 纯文本）上离线应用 patch，获得更新后的 HTML 和 inversePatches，绝不修改实时 editor DOM
      const { updatedHtml, inversePatches } = applySemanticPatchesToHtml(
        originalHtml,
        proposal.patches,
        current,
      )

      // 2. 通过 ProposalChapterUnitOfWork 原子提交（严格 fail-closed，绝不降级至非原子旧路径）
      const receipt = await ProposalChapterUnitOfWork.commitProposalWithChapter({
        workspaceId: targetWorkspaceId,
        chapterId: targetChapterId,
        proposalId: proposal.id,
        expectedRevision: proposal.baseRevision,
        nextContent: updatedHtml,
        inversePatches,
        sourceHash: hashText(current.text),
        eventScope: proposalScopeRef.current,
      })

      // 3. 落盘彻底成功后同步视口，绝不触发 editor onUpdate / autosave (INV-02)
      if (
        activeContextRef.current.workspaceId === targetWorkspaceId &&
        activeContextRef.current.chapterId === proposal.documentId &&
        editor.commands?.setContent
      ) {
        editor.commands.setContent(updatedHtml, { emitUpdate: false })
      }

      await proposalLedger.reload().catch(() => {})
      const committedProposal = proposalLedger.get(proposal.id) ?? {
        ...proposal,
        status: 'committed' as const,
        committedRevision: receipt.revision,
        inversePatches,
      }
      setRewriteProposal((value) =>
        value
          ? {
              ...value,
              proposal: committedProposal,
              status: 'committed',
              error: undefined,
            }
          : value,
      )
    } catch (error) {
      const stale =
        error instanceof ProposalConflictError ||
        isProposalSyncError(error) ||
        /source hash|stale|版本冲突/i.test(String(error))
      const nextStatus = stale ? 'stale' : 'pending'
      const latestProposal = proposalLedger.get(proposal.id) ?? proposal
      setRewriteProposal((value) =>
        value
          ? {
              ...value,
              proposal: {
                ...latestProposal,
                status: nextStatus,
              },
              status: nextStatus,
              error: error instanceof Error ? error.message : String(error),
            }
          : value,
      )
    }
  }

  const rejectRewrite = () => {
    if (
      !rewriteProposal ||
      rewriteProposal.status !== 'pending' ||
      rewriteProposal.proposal.documentId !== currentDocumentId
    ) {
      return
    }
    proposalLedger.reject(rewriteProposal.proposal.id)
    setRewriteProposal((value) => (value ? { ...value, status: 'rejected' } : value))
  }

  const undoRewrite = async () => {
    if (
      !rewriteProposal ||
      rewriteProposal.status !== 'committed' ||
      rewriteProposal.proposal.documentId !== currentDocumentId
    ) {
      return
    }
    const targetWorkspaceId = initialProjectId || ''
    const targetChapterId = rewriteProposal.proposal.documentId
    const currentRev = rewriteProposal.proposal.committedRevision ?? activeChapterRevision

    const originalHtml = editor.getHTML?.() ?? editor.getText?.() ?? currentSemanticDocument().text

    try {
      const inversePatches = rewriteProposal.proposal.inversePatches
      if (!inversePatches?.length) {
        throw new Error('No inverse patches found on proposal')
      }

      const current = currentSemanticDocument()

      // 1. 在影子文档上应用反向补丁，获得恢复后的 HTML，不触碰实时 editor DOM
      const { updatedHtml: restoredHtml } = applySemanticPatchesToHtml(
        originalHtml,
        inversePatches,
        current,
      )

      // 2. 通过 ProposalChapterUnitOfWork 原子回滚（严格 fail-closed，绝不降级至非原子旧路径）
      await ProposalChapterUnitOfWork.undoProposalWithChapter({
        workspaceId: targetWorkspaceId,
        chapterId: targetChapterId,
        proposalId: rewriteProposal.proposal.id,
        expectedRevision: currentRev ?? rewriteProposal.proposal.committedRevision ?? 1,
        restoredContent: restoredHtml,
        eventScope: proposalScopeRef.current,
      })

      // 3. 落盘彻底成功后同步视口，不触发 editor onUpdate / autosave (INV-02)
      if (
        activeContextRef.current.workspaceId === targetWorkspaceId &&
        activeContextRef.current.chapterId === targetChapterId &&
        editor.commands?.setContent
      ) {
        editor.commands.setContent(restoredHtml, { emitUpdate: false })
      }

      await proposalLedger.reload().catch(() => {})
      const undoneProposal = proposalLedger.get(rewriteProposal.proposal.id) ?? {
        ...rewriteProposal.proposal,
        status: 'undone' as const,
      }
      setRewriteProposal((value) =>
        value
          ? {
              ...value,
              proposal: undoneProposal,
              status: 'undone',
              error: undefined,
            }
          : value,
      )
    } catch (error) {
      setRewriteProposal((value) =>
        value
          ? {
              ...value,
              status: 'stale',
              error: error instanceof Error ? error.message : String(error),
            }
          : value,
      )
    }
  }

  return (
    <motion.div
      {...variants.fadeDown}
      transition={spring.gentle}
      className="absolute z-20 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-1 py-1 shadow-[var(--ink-shadow-lg)]"
      style={{ top: state.show ? state.top : 20, left: state.show ? state.left : 20 }}
      // 阻止 mousedown 抢占选区，确保点击工具条时选区不丢失
      onMouseDown={(event) => {
        const target = event.target
        if (target instanceof HTMLElement && target.closest('textarea, input')) return
        event.preventDefault()
      }}
    >
      {state.show && (
        <>
          <Tooltip content="加粗">
            <motion.button
              type="button"
              {...gesture.iconButton}
              transition={spring.snappy}
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('bold') ? 'text-[var(--ink-accent)]' : ''}`}
            >
              <Bold className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
          <Tooltip content="斜体">
            <motion.button
              type="button"
              {...gesture.iconButton}
              transition={spring.snappy}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('italic') ? 'text-[var(--ink-accent)]' : ''}`}
            >
              <Italic className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
          <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
          <Tooltip content="调用 InkPi AI 划词润色">
            <motion.button
              type="button"
              {...gesture.button}
              transition={spring.snappy}
              onClick={() => void aiPolish()}
              className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-[var(--ink-accent)] hover:bg-[var(--ink-accent-soft)] transition-colors duration-150 cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              <span>{rewriteBusy ? '处理中…' : 'AI 润色'}</span>
            </motion.button>
          </Tooltip>
          <Tooltip content="先写下语气、篇幅或描写方面的要求">
            <motion.button
              type="button"
              {...gesture.button}
              transition={spring.snappy}
              onClick={openRewriteComposer}
              aria-label="按要求修改"
              className="px-2 py-1 rounded-md text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors duration-150 cursor-pointer"
            >
              按要求修改
            </motion.button>
          </Tooltip>

          {/* 划词直接触发断章张力分析抽屉 */}
          {host && state.show && (
            <>
              <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
              <Tooltip content="查看所选文本追读与断章张力">
                <motion.button
                  type="button"
                  {...gesture.button}
                  transition={spring.snappy}
                  onClick={() => {
                    host.openDrawer('reader-hook')
                  }}
                  className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-amber-500 hover:bg-amber-500/10 transition-colors duration-150 cursor-pointer"
                >
                  <Anchor className="w-3 h-3" />
                  <span>断章感知</span>
                </motion.button>
              </Tooltip>
            </>
          )}

          {/* 划词直接触发文学质量门禁体检 */}
          {host && state.show && (
            <Tooltip content="排查所选文字是否存在副词堆叠、长句或热梗">
              <motion.button
                type="button"
                {...gesture.button}
                transition={spring.snappy}
                onClick={() => {
                  host.openDrawer('narrative-linter')
                }}
                className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-emerald-500 hover:bg-emerald-500/10 transition-colors duration-150 cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>文字体检</span>
              </motion.button>
            </Tooltip>
          )}

          {onOpenAssistant && state.show && (
            <Tooltip content="在右侧助手面板中讨论或深度扩写">
              <motion.button
                type="button"
                {...gesture.button}
                transition={spring.snappy}
                onClick={onOpenAssistant}
                className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors duration-150 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>AI 对话</span>
              </motion.button>
            </Tooltip>
          )}
        </>
      )}
      {rewriteComposerOpen && (
        <form
          data-testid="rewrite-instruction-form"
          onSubmit={submitRewrite}
          className="mt-2 w-72 rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-2 text-xs shadow-[var(--ink-shadow-lg)]"
        >
          <label htmlFor="rewrite-instruction" className="mb-1 block font-medium">
            修改要求（可选）
          </label>
          <textarea
            id="rewrite-instruction"
            aria-label="修改要求"
            value={rewriteInstruction}
            onChange={(event) => setRewriteInstruction(event.target.value)}
            placeholder="例如：压缩句子、调整语气或补充动作细节"
            rows={2}
            maxLength={500}
            className="w-full resize-y rounded border border-[var(--ink-border)] bg-[var(--ink-bg)] p-2 text-[var(--ink-text)] outline-none focus:border-[var(--ink-accent)]"
          />
          {rewriteError && (
            <div data-testid="rewrite-task-error" role="alert" className="mt-1 text-rose-500">
              {rewriteError}
            </div>
          )}
          <div className="mt-2 flex gap-1">
            <motion.button
              type="submit"
              {...gesture.button}
              transition={spring.snappy}
              disabled={rewriteBusy}
              className="rounded bg-[var(--ink-accent)] px-2 py-1 text-white disabled:opacity-50"
            >
              {rewriteBusy ? '处理中…' : '生成建议'}
            </motion.button>
            {rewriteError && lastRewriteRequestRef.current && (
              <motion.button
                type="button"
                {...gesture.button}
                transition={spring.snappy}
                onClick={retryRewrite}
                disabled={rewriteBusy}
                className="rounded border border-[var(--ink-border)] px-2 py-1 disabled:opacity-50"
              >
                重试
              </motion.button>
            )}
            <motion.button
              type="button"
              {...gesture.button}
              transition={spring.snappy}
              onClick={cancelRewriteComposer}
              disabled={rewriteBusy}
              className="rounded border border-[var(--ink-border)] px-2 py-1 disabled:opacity-50"
            >
              取消
            </motion.button>
          </div>
        </form>
      )}
      {rewriteError && !rewriteComposerOpen && !currentRewriteProposal && (
        <div
          data-testid="rewrite-task-error"
          role="alert"
          className="mt-2 flex max-w-sm items-center gap-2 rounded-md border border-rose-500/40 bg-[var(--ink-bg-panel)] p-2 text-xs"
        >
          <span className="flex-1 text-rose-500">{rewriteError}</span>
          {lastRewriteRequestRef.current && (
            <motion.button
              type="button"
              {...gesture.button}
              transition={spring.snappy}
              onClick={retryRewrite}
              disabled={rewriteBusy}
              className="rounded border border-[var(--ink-border)] px-2 py-1 disabled:opacity-50"
            >
              重试
            </motion.button>
          )}
          <motion.button
            type="button"
            {...gesture.button}
            transition={spring.snappy}
            onClick={openRewriteComposer}
            className="rounded border border-[var(--ink-border)] px-2 py-1"
          >
            修改要求
          </motion.button>
        </div>
      )}
      <AnimatePresence>
        {currentRewriteProposal && (
          <motion.div
            {...variants.fadeUp}
            transition={spring.gentle}
            data-testid="rewrite-proposal-preview"
            className="mt-2 max-w-sm rounded-md border border-[var(--ink-accent)]/40 bg-[var(--ink-bg-panel)] p-2 text-xs"
          >
            <div className="mb-1 font-medium">润色提案 · {currentRewriteProposal.status}</div>
            <div className="space-y-1">
              <div className="rounded bg-rose-500/10 p-1 line-through">
                {currentRewriteProposal.originalText || '（空）'}
              </div>
              <div className="rounded bg-emerald-500/10 p-1">
                {currentRewriteProposal.proposedText || '（空）'}
              </div>
            </div>
            {currentRewriteProposal.error && (
              <div className="mt-1 text-rose-500">{currentRewriteProposal.error}</div>
            )}
            {currentRewriteProposal.status === 'stale' && (
              <div data-testid="rewrite-proposal-conflict" className="mt-1 text-amber-500">
                其他窗口的修改使此提案产生冲突，请重新审阅。
              </div>
            )}
            {currentRewriteProposal.status === 'pending' && (
              <div className="mt-2 flex gap-1">
                <motion.button
                  type="button"
                  {...gesture.button}
                  transition={spring.snappy}
                  onClick={() => void commitRewrite()}
                  className="rounded bg-emerald-600 px-2 py-1 text-white"
                >
                  接受
                </motion.button>
                <motion.button
                  type="button"
                  {...gesture.button}
                  transition={spring.snappy}
                  onClick={rejectRewrite}
                  className="rounded border border-[var(--ink-border)] px-2 py-1"
                >
                  拒绝
                </motion.button>
              </div>
            )}
            {currentRewriteProposal.status === 'committed' && (
              <motion.button
                type="button"
                {...gesture.button}
                transition={spring.snappy}
                onClick={() => void undoRewrite()}
                className="mt-2 rounded border border-[var(--ink-border)] px-2 py-1"
              >
                撤销
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default SelectionToolbar

function normalizeScopeId(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}
