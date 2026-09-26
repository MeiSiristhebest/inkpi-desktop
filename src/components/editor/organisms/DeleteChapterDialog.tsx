import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface DeleteChapterDialogProps {
  model: EditorModel
}

/** 章节删除二次确认弹窗。organisms 层，仅声明式渲染。 */
export const DeleteChapterDialog: React.FC<DeleteChapterDialogProps> = ({ model }) => {
  const { deletingChapter, actions } = model
  if (!deletingChapter) return null
  return (
    <ConfirmDialog
      open
      danger
      title="删除章节确认"
      confirmText="确认删除"
      cancelText="取消"
      onCancel={() => actions.setDeletingChapter(null)}
      onConfirm={() => actions.deleteChapter(deletingChapter)}
    >
      <p className="text-[12.5px] text-[var(--ink-text-muted)] leading-relaxed">
        确定要删除「<strong className="text-[var(--ink-text)]">{deletingChapter.title}</strong>
        」吗？包含{' '}
        <span className="text-[var(--ink-accent)] font-mono">{deletingChapter.wordCount}</span>
        字正文，删除后将无法通过编辑器直接撤销。
      </p>
    </ConfirmDialog>
  )
}
