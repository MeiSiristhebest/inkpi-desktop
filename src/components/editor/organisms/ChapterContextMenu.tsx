import { Edit3, Copy, Check, Hash, FileDown, Trash2, FolderInput } from 'lucide-react'
import { STATUS_OPTIONS } from '../editorUi'
import type { ChapterStatus } from '../../../types'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import { ContextMenu, type ContextMenuItem } from '../../../ui/molecules/ContextMenu'

interface ChapterContextMenuProps {
  model: EditorModel
}

/**
 * 章节右键上下文菜单。organisms 层，仅声明式渲染，命令走 model.actions.*。
 * 条目配置驱动，role=menu / 键盘导航复用 ui/molecules/ContextMenu，不再自带一份（P4.3）；
 * 状态标记改为 menuitemradio，让「当前是哪一档」既能看见也能读到。
 */
export const ChapterContextMenu: React.FC<ChapterContextMenuProps> = ({ model }) => {
  const { chapterContextMenu, copiedChapterId, excludedNumberingIds, volumes, actions } = model
  if (!chapterContextMenu) return null

  const ch = chapterContextMenu.chapter
  const close = () => actions.setChapterContextMenu(null)
  const pick = (run: () => void) => () => {
    close()
    run()
  }

  const otherVolumes = (volumes ?? []).filter((v) => v.id !== ch.volumeId)

  const items: ContextMenuItem[] = [
    {
      key: 'rename',
      label: '重命名 (F2)',
      icon: <Edit3 size={13} />,
      onClick: pick(() => {
        actions.setRenamingChapter(ch)
        actions.setRenamingTitle(ch.title)
      }),
    },
    {
      key: 'duplicate',
      label: '复制 / 创建副本',
      icon: <Copy size={13} />,
      onClick: pick(() => actions.duplicateChapter(ch)),
    },
    {
      key: 'copyText',
      label: copiedChapterId === ch.id ? '已复制纯文本' : '复制正文到剪贴板',
      icon:
        copiedChapterId === ch.id ? (
          <Check size={13} className="text-[var(--ink-success)]" />
        ) : (
          <Copy size={13} />
        ),
      onClick: pick(() => actions.copyChapterText(ch)),
    },
    {
      key: 'numbering',
      label: excludedNumberingIds.has(ch.id) ? '恢复计入正文序号' : '设为不计入序号(序章/番外)',
      icon: <Hash size={13} />,
      onClick: pick(() => actions.toggleExcludeNumbering(ch.id)),
    },
    ...STATUS_OPTIONS.map((st, idx) => ({
      key: `status-${st.value}`,
      label: `状态：${st.label}`,
      dividerBefore: idx === 0,
      checked: ch.status === st.value,
      onClick: pick(() => actions.setStatus(st.value as ChapterStatus)),
    })),
    {
      key: 'exportTxt',
      label: '导出为 TXT 纯文本',
      icon: <FileDown size={13} />,
      dividerBefore: true,
      onClick: pick(() => actions.exportSingleChapter(ch, 'txt')),
    },
    {
      key: 'exportMd',
      label: '导出为 Markdown',
      icon: <FileDown size={13} />,
      onClick: pick(() => actions.exportSingleChapter(ch, 'md')),
    },
    ...otherVolumes.map((v, idx) => ({
      key: `move-${v.id}`,
      label: `移入「${v.title}」`,
      icon: <FolderInput size={13} />,
      dividerBefore: idx === 0,
      onClick: pick(() => actions.moveChapterToVolume(ch, v.id)),
    })),
    {
      key: 'delete',
      label: '删除本章节',
      icon: <Trash2 size={13} />,
      danger: true,
      dividerBefore: true,
      onClick: pick(() => actions.setDeletingChapter(ch)),
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
        header={ch.title}
        position={{ x: chapterContextMenu.x, y: chapterContextMenu.y }}
        widthClass="min-w-[240px] max-w-[300px]"
        ariaLabel={`章节操作：${ch.title}`}
        onClose={close}
      />
    </>
  )
}
