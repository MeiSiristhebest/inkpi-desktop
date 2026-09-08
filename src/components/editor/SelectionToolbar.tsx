import { useEffect, useState, type RefObject } from 'react'
import { Bold, Italic, Wand2, Anchor, CheckCircle2 } from 'lucide-react'
import { useOptionalPluginHostContext } from '../../core/pluginHostContext'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { createRewriteTask } from '../../ai'
import { semanticDocumentFromProseMirror, semanticDocumentFromText } from '../../domain/content'
import { hashText, ProposalConflictError, ProposalLedger, proposalFromPatch, type AiProposal } from '../../ai/proposals'

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
}

interface ToolbarState {
  show: boolean
  top: number
  left: number
}

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
}) => {
  const host = useOptionalPluginHostContext()
  const [state, setState] = useState<ToolbarState>({ show: false, top: 0, left: 0 })
  const [rewriteProposal, setRewriteProposal] = useState<{
    proposal: AiProposal
    originalText: string
    proposedText: string
    status: 'pending' | 'committed' | 'stale' | 'rejected' | 'undone'
    error?: string
  } | null>(null)
  const [rewriteBusy, setRewriteBusy] = useState(false)
  const proposalLedger = useState(() => new ProposalLedger())[0]

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

  if ((!state.show && !rewriteProposal) || !editor) return null

  const currentSemanticDocument = () =>
    typeof editor.state?.doc?.toJSON === 'function'
      ? semanticDocumentFromProseMirror(activeChapterId || 'selection', editor.state.doc.toJSON(), activeChapterRevision)
      : semanticDocumentFromText(activeChapterId || 'selection', editor.getText?.() || '', activeChapterRevision)

  const aiPolish = async () => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text || !onAiTask || rewriteBusy) return
    const semanticDocument = currentSemanticDocument()
    const selection = semanticDocument.sourceMap.editorRangeToSemantic({ from, to })
    const sourceHash = hashText(semanticDocument.text)
    setRewriteBusy(true)
    onOpenAssistant?.()
    try {
      const result = await onAiTask(
        createRewriteTask({
          taskId: `rewrite-${activeChapterId || 'selection'}-${Date.now().toString(36)}`,
          document: semanticDocument,
          selection,
          goal: '保持事实和原意，改进选中文本',
          metadata: { source: 'selection-toolbar', sourceHash },
        }),
      )
      if (!result) return
      const proposal = proposalFromPatch(result, {
        id: `proposal-${result.taskId}`,
        documentId: semanticDocument.documentId,
        baseRevision: activeChapterRevision,
        sourceHash,
      })
      const patch = proposal.patches[0]
      if (patch.from < selection.from || patch.to > selection.to) {
        throw new Error('Rewrite proposal must stay within the selected semantic range')
      }
      proposalLedger.create(proposal)
      setRewriteProposal({
        proposal,
        originalText: semanticDocument.text.slice(patch.from, patch.to),
        proposedText: patch.text,
        status: 'pending',
      })
    } catch (error) {
      setRewriteProposal((current) => current ? { ...current, error: error instanceof Error ? error.message : String(error) } : current)
    } finally {
      setRewriteBusy(false)
    }
  }

  const commitRewrite = async () => {
    if (!rewriteProposal || rewriteProposal.status !== 'pending') return
    const current = currentSemanticDocument()
    const proposal = rewriteProposal.proposal
    try {
      proposalLedger.accept(proposal.id)
      await proposalLedger.commit(
        proposal.id,
        activeChapterRevision,
        (patches) => {
          const inversePatches = patches.map((patch) => ({
            ...patch,
            to: patch.from + patch.text.length,
            text: current.text.slice(patch.from, patch.to),
          }))
          for (const patch of [...patches].sort((left, right) => right.from - left.from)) {
            const range = current.sourceMap.semanticRangeToEditor(patch.from, patch.to)
            editor.commands.insertContentAt({ from: range.from, to: range.to }, patch.text)
          }
          return { inversePatches }
        },
        hashText(current.text),
      )
      setRewriteProposal((value) => value ? { ...value, status: 'committed', error: undefined } : value)
    } catch (error) {
      const stale = error instanceof ProposalConflictError || /source hash|stale/i.test(String(error))
      setRewriteProposal((value) => value ? {
        ...value,
        status: stale ? 'stale' : value.status,
        error: error instanceof Error ? error.message : String(error),
      } : value)
    }
  }

  const rejectRewrite = () => {
    if (!rewriteProposal || rewriteProposal.status !== 'pending') return
    proposalLedger.reject(rewriteProposal.proposal.id)
    setRewriteProposal((value) => value ? { ...value, status: 'rejected' } : value)
  }

  const undoRewrite = async () => {
    if (!rewriteProposal || rewriteProposal.status !== 'committed') return
    try {
      await proposalLedger.undo(rewriteProposal.proposal.id, rewriteProposal.proposal.committedRevision ?? activeChapterRevision, (patches) => {
        const current = currentSemanticDocument()
        for (const patch of [...patches].sort((left, right) => right.from - left.from)) {
          const range = current.sourceMap.semanticRangeToEditor(patch.from, patch.to)
          editor.commands.insertContentAt({ from: range.from, to: range.to }, patch.text)
        }
      })
      setRewriteProposal((value) => value ? { ...value, status: 'undone', error: undefined } : value)
    } catch (error) {
      setRewriteProposal((value) => value ? { ...value, status: 'stale', error: error instanceof Error ? error.message : String(error) } : value)
    }
  }

  return (
    <div
      className="absolute z-20 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-1 py-1 shadow-[var(--ink-shadow-lg)]"
      style={{ top: state.show ? state.top : 20, left: state.show ? state.left : 20 }}
      // 阻止 mousedown 抢占选区，确保点击工具条时选区不丢失
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.show && <>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('bold') ? 'text-[var(--ink-accent)]' : ''}`}
        title="加粗"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('italic') ? 'text-[var(--ink-accent)]' : ''}`}
        title="斜体"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
      <button
        type="button"
        onClick={() => void aiPolish()}
        className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-[var(--ink-accent)] hover:bg-[var(--ink-accent-soft)] transition-colors duration-150 cursor-pointer"
        title="调用 InkPi AI 划词润色"
      >
        <Wand2 className="w-3 h-3" />
        <span>{rewriteBusy ? '处理中…' : 'AI 润色'}</span>
      </button>

      {/* 划词直接触发断章张力分析抽屉 */}
      {host && state.show && (
        <>
          <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
          <button
            type="button"
            onClick={() => {
              host.openDrawer('reader-hook')
            }}
            className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-amber-500 hover:bg-amber-500/10 transition-colors duration-150 cursor-pointer"
            title="查看所选文本追读与断章张力"
          >
            <Anchor className="w-3 h-3" />
            <span>断章感知</span>
          </button>
        </>
      )}

      {/* 划词直接触发文学质量门禁体检 */}
      {host && state.show && (
        <button
          type="button"
          onClick={() => {
            host.openDrawer('narrative-linter')
          }}
          className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-emerald-500 hover:bg-emerald-500/10 transition-colors duration-150 cursor-pointer"
          title="排查所选文字是否存在副词堆叠、长句或热梗"
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>文字体检</span>
        </button>
      )}
      </>}
      {rewriteProposal && (
        <div data-testid="rewrite-proposal-preview" className="mt-2 max-w-sm rounded-md border border-[var(--ink-accent)]/40 bg-[var(--ink-bg-panel)] p-2 text-xs">
          <div className="mb-1 font-medium">润色提案 · {rewriteProposal.status}</div>
          <div className="space-y-1">
            <div className="rounded bg-rose-500/10 p-1 line-through">{rewriteProposal.originalText || '（空）'}</div>
            <div className="rounded bg-emerald-500/10 p-1">{rewriteProposal.proposedText || '（空）'}</div>
          </div>
          {rewriteProposal.error && <div className="mt-1 text-rose-500">{rewriteProposal.error}</div>}
          {rewriteProposal.status === 'pending' && <div className="mt-2 flex gap-1">
            <button type="button" onClick={() => void commitRewrite()} className="rounded bg-emerald-600 px-2 py-1 text-white">接受</button>
            <button type="button" onClick={rejectRewrite} className="rounded border border-[var(--ink-border)] px-2 py-1">拒绝</button>
          </div>}
          {rewriteProposal.status === 'committed' && <button type="button" onClick={() => void undoRewrite()} className="mt-2 rounded border border-[var(--ink-border)] px-2 py-1">撤销</button>}
        </div>
      )}
    </div>
  )
}

export default SelectionToolbar
