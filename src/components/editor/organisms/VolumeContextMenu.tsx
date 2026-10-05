import React from 'react'
import { Edit3, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import { ContextMenu, type ContextMenuItem } from '../../../ui/molecules/ContextMenu'

interface VolumeContextMenuProps {
  model: EditorModel
}

/**
 * 分卷右键上下文菜单。organisms 层，仅声明式渲染，命令走 model.actions.*。
 * 条目配置驱动，role=menu / 键盘导航复用 ui/molecules/ContextMenu，不再自带一份（P4.3）。
 */
export const VolumeContextMenu: React.FC<VolumeContextMenuProps> = ({ model }) => {
  const { volumeContextMenu, expanded, actions } = model
  if (!volumeContextMenu) return null

  const vol = volumeContextMenu.volume
  const isOpen = expanded[vol.id] !== false
  const close = () => actions.setVolumeContextMenu(null)
  const pick = (run: () => void) => () => {
    close()
    run()
  }

  const items: ContextMenuItem[] = [
    {
      key: 'newChapter',
      label: '新建章节 (插入本卷)',
      icon: <Plus size={13} />,
      onClick: pick(() => actions.newChapter(vol.id)),
    },
    {
      key: 'rename',
      label: '重命名分卷',
      icon: <Edit3 size={13} />,
      onClick: pick(() => {
        actions.setRenamingVolume(vol)
        actions.setRenamingVolumeTitle(vol.title)
      }),
    },
    {
      key: 'toggle',
      label: isOpen ? '收起此分卷' : '展开此分卷',
      icon: isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />,
      onClick: pick(() => actions.toggleVolume(vol.id)),
    },
    {
      key: 'delete',
      label: '删除分卷…',
      icon: <Trash2 size={13} />,
      danger: true,
      dividerBefore: true,
      onClick: pick(() => actions.setDeletingVolume(vol)),
    },
  ]

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={close}
        onContextMenu={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <ContextMenu
        items={items}
        header={vol.title}
        position={{ x: volumeContextMenu.x, y: volumeContextMenu.y }}
        widthClass="min-w-[200px] max-w-[260px]"
        ariaLabel={`分卷操作：${vol.title}`}
        onClose={close}
      />
    </>
  )
}
