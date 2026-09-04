import React from 'react'
import { Edit3, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface VolumeContextMenuProps {
  model: EditorModel
}

/** 分卷右键上下文菜单。organisms 层，仅声明式渲染，命令走 model.actions.* */
export const VolumeContextMenu: React.FC<VolumeContextMenuProps> = ({ model }) => {
  const { volumeContextMenu, expanded, actions } = model
  if (!volumeContextMenu) return null
  const vol = volumeContextMenu.volume
  const isOpen = expanded[vol.id] !== false

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => actions.setVolumeContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault()
          actions.setVolumeContextMenu(null)
        }}
      />
      <div
        className="fixed z-50 min-w-[200px] w-auto max-w-[260px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12.5px] select-none backdrop-blur-md"
        style={{ left: volumeContextMenu.x, top: volumeContextMenu.y }}
      >
        <div className="px-2.5 py-1.5 border-b border-[var(--ink-border)]/60 text-[11px] text-[var(--ink-text-faint)] truncate font-medium">
          {vol.title}
        </div>

        <button
          type="button"
          onClick={() => {
            actions.setVolumeContextMenu(null)
            actions.newChapter(vol.id)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Plus size={13} className="text-[var(--ink-accent)] shrink-0" />
          <span className="whitespace-nowrap">新建章节 (插入本卷)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            actions.setVolumeContextMenu(null)
            actions.setRenamingVolume(vol)
            actions.setRenamingVolumeTitle(vol.title)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Edit3 size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">重命名分卷</span>
        </button>

        <button
          type="button"
          onClick={() => {
            actions.setVolumeContextMenu(null)
            actions.toggleVolume(vol.id)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          {isOpen ? (
            <ChevronDown size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          )}
          <span className="whitespace-nowrap">{isOpen ? '收起此分卷' : '展开此分卷'}</span>
        </button>

        <div className="border-t border-[var(--ink-border)]/60 my-1" />

        <button
          type="button"
          onClick={() => {
            actions.setVolumeContextMenu(null)
            actions.setDeletingVolume(vol)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-danger)] hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Trash2 size={13} className="text-[var(--ink-danger)] shrink-0" />
          <span className="whitespace-nowrap">删除分卷…</span>
        </button>
      </div>
    </>
  )
}
