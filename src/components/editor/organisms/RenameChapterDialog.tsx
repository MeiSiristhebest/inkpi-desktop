import type { EditorModel } from '../hooks/useChapterEditorModel'

interface RenameChapterDialogProps {
  model: EditorModel
}

/** 章节重命名弹窗。organisms 层，仅声明式渲染。 */
export const RenameChapterDialog: React.FC<RenameChapterDialogProps> = ({ model }) => {
  const { renamingChapter, renamingTitle, actions } = model
  if (!renamingChapter) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-[360px] p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] shadow-2xl">
        <h3 className="text-[14px] font-semibold mb-3">重命名章节</h3>
        <input
          type="text"
          autoFocus
          value={renamingTitle}
          onChange={(e) => actions.setRenamingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              actions.renameChapter(renamingChapter, renamingTitle)
            } else if (e.key === 'Escape') {
              actions.setRenamingChapter(null)
            }
          }}
          placeholder="请输入章节新标题"
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] text-[var(--ink-text)] focus:outline-hidden focus:border-[var(--ink-accent)]"
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => actions.setRenamingChapter(null)}
            className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => actions.renameChapter(renamingChapter, renamingTitle)}
            disabled={!renamingTitle.trim()}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-50 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
