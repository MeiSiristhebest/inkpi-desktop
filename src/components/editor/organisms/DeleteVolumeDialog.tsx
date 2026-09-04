import React from 'react'
import { Trash2 } from 'lucide-react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-[380px] p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] shadow-2xl">
        <h3 className="text-[14px] font-semibold text-[var(--ink-danger)] mb-2 flex items-center gap-1.5">
          <Trash2 size={16} /> 删除分卷确认
        </h3>
        <p className="text-[12.5px] text-[var(--ink-text-muted)] leading-relaxed mb-3">
          确定要删除「<strong className="text-[var(--ink-text)]">{deletingVolume.title}</strong>
          」吗？
        </p>
        {volChapters.length > 0 && (
          <div className="p-2.5 rounded-lg bg-[var(--ink-bg-hover)] text-[11.5px] text-[var(--ink-text-muted)] leading-normal mb-4">
            该分卷内含有{' '}
            <span className="text-[var(--ink-accent)] font-semibold">{volChapters.length}</span>{' '}
            个章节。
            {otherVolumes.length > 0 ? (
              <span>删除后，这些章节将自动安全移入「{otherVolumes[0].title}」，绝不丢失内容。</span>
            ) : (
              <span className="text-[var(--ink-danger)]">注意：这是全书唯一分卷，删除将连同章节一并清除。</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => actions.setDeletingVolume(null)}
            className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => actions.deleteVolume(deletingVolume)}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-danger)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
