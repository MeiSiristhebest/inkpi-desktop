import { useId } from 'react'
import { Modal } from '../../../ui/molecules/Modal'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface RenameVolumeDialogProps {
  model: EditorModel
}

/** 分卷重命名弹窗。organisms 层，仅声明式渲染。 */
export const RenameVolumeDialog: React.FC<RenameVolumeDialogProps> = ({ model }) => {
  const { renamingVolume, renamingVolumeTitle, actions } = model
  const titleId = useId()
  const inputId = useId()
  if (!renamingVolume) return null

  const commit = () => actions.renameVolume(renamingVolume, renamingVolumeTitle)

  return (
    <Modal
      onClose={() => actions.setRenamingVolume(null)}
      ariaLabelledBy={titleId}
      widthClass="max-w-[380px]"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-[14px] font-semibold mb-3">
          重命名分卷
        </h2>
        <label htmlFor={inputId} className="sr-only">
          分卷新名称
        </label>
        <input
          id={inputId}
          type="text"
          value={renamingVolumeTitle}
          onChange={(e) => actions.setRenamingVolumeTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder="请输入分卷新名称（如：第二卷 · 潜龙在渊）"
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] text-[var(--ink-text)] focus:outline-hidden focus:border-[var(--ink-accent)]"
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => actions.setRenamingVolume(null)}
            className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!renamingVolumeTitle.trim()}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            确定
          </button>
        </div>
      </div>
    </Modal>
  )
}
