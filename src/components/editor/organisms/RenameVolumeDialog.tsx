import React from 'react'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface RenameVolumeDialogProps {
  model: EditorModel
}

/** 分卷重命名弹窗。organisms 层，仅声明式渲染。 */
export const RenameVolumeDialog: React.FC<RenameVolumeDialogProps> = ({ model }) => {
  const { renamingVolume, renamingVolumeTitle, actions } = model
  if (!renamingVolume) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-[360px] p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] shadow-2xl">
        <h3 className="text-[14px] font-semibold mb-3">重命名分卷</h3>
        <input
          type="text"
          autoFocus
          value={renamingVolumeTitle}
          onChange={(e) => actions.setRenamingVolumeTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              actions.renameVolume(renamingVolume, renamingVolumeTitle)
            } else if (e.key === 'Escape') {
              actions.setRenamingVolume(null)
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
            onClick={() => actions.renameVolume(renamingVolume, renamingVolumeTitle)}
            disabled={!renamingVolumeTitle.trim()}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
