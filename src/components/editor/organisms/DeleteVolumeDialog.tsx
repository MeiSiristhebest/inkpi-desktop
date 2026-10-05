import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface DeleteVolumeDialogProps {
  model: EditorModel
}

/** 分卷删除二次确认弹窗。organisms 层，仅声明式渲染。 */
export const DeleteVolumeDialog: React.FC<DeleteVolumeDialogProps> = ({ model }) => {
  const { deletingVolume, chapters, volumes, actions } = model
  if (!deletingVolume) return null

  const volChapters = chapters.filter((c) => c.volumeId === deletingVolume.id)
  const otherVolumes = volumes.filter((v) => v.id !== deletingVolume.id)

  return (
    <ConfirmDialog
      open
      danger
      title="删除分卷确认"
      confirmText="确认删除"
      cancelText="取消"
      onCancel={() => actions.setDeletingVolume(null)}
      onConfirm={() => actions.deleteVolume(deletingVolume)}
    >
      <p className="text-[12.5px] text-[var(--ink-text-muted)] leading-relaxed">
        确定要删除「<strong className="text-[var(--ink-text)]">{deletingVolume.title}</strong>」吗？
      </p>
      {volChapters.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[var(--ink-bg-hover)] text-[11.5px] text-[var(--ink-text-muted)] leading-normal">
          该分卷内含有{' '}
          <span className="text-[var(--ink-accent)] font-semibold">{volChapters.length}</span>{' '}
          个章节。
          {otherVolumes.length > 0 ? (
            <span>删除后，这些章节将自动安全移入「{otherVolumes[0].title}」，绝不丢失内容。</span>
          ) : (
            <span className="text-[var(--ink-danger)]">
              注意：这是全书唯一分卷，删除将连同章节一并清除。
            </span>
          )}
        </div>
      )}
    </ConfirmDialog>
  )
}
