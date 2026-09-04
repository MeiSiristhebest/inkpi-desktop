import { Trash2 } from 'lucide-react'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface DeleteChapterDialogProps {
  model: EditorModel
}

/** 章节删除二次确认弹窗。organisms 层，仅声明式渲染。 */
export const DeleteChapterDialog: React.FC<DeleteChapterDialogProps> = ({ model }) => {
  const { deletingChapter, actions } = model
  if (!deletingChapter) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-[380px] p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] shadow-2xl">
        <h3 className="text-[14px] font-semibold text-[var(--ink-danger)] mb-2 flex items-center gap-1.5">
          <Trash2 size={16} /> 删除章节确认
        </h3>
        <p className="text-[12.5px] text-[var(--ink-text-muted)] leading-relaxed mb-4">
          确定要删除「<strong className="text-[var(--ink-text)]">{deletingChapter.title}</strong>
          」吗？包含{' '}
          <span className="text-[var(--ink-accent)] font-mono">{deletingChapter.wordCount}</span>{' '}
          字正文，删除后将无法通过编辑器直接撤销。
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => actions.setDeletingChapter(null)}
            className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => actions.deleteChapter(deletingChapter)}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-danger)] text-white hover:opacity-90 transition-opacity"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
