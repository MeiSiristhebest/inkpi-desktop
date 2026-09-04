import { Pencil, Upload, BookText, Trash2 } from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '../../../ui/molecules/ContextMenu'

interface ProjectContextMenuProps {
  hasUpdate: boolean
  hasExport: boolean
  onClose: () => void
  onEdit: () => void
  onExport: () => void
  onDelete: () => void
}

/**
 * 作品卡片右上角的「更多操作」气泡菜单（原子设计 · organisms）。
 * 条目以配置驱动，复用通用 ContextMenu 分子（§10/§11）；菜单开关状态由父级 ProjectCard 持有。
 */
export const ProjectContextMenu = ({
  hasUpdate,
  hasExport,
  onClose,
  onEdit,
  onExport,
  onDelete,
}: ProjectContextMenuProps) => {
  const items: ContextMenuItem[] = []
  if (hasUpdate) {
    items.push({
      key: 'edit',
      label: '编辑信息',
      icon: <Pencil size={13} />,
      onClick: () => {
        onClose()
        onEdit()
      },
    })
  }
  if (hasExport) {
    items.push({
      key: 'export',
      label: '导出备份',
      icon: <Upload size={13} />,
      onClick: () => {
        onClose()
        onExport()
      },
    })
  }
  items.push({
    key: 'exportSetting',
    label: '导出设定集',
    icon: <BookText size={13} />,
    onClick: () => {
      onClose()
      onExport()
    },
  })
  if (hasUpdate) {
    items.push({
      key: 'delete',
      label: '删除作品',
      icon: <Trash2 size={13} />,
      danger: true,
      dividerBefore: true,
      onClick: () => {
        onClose()
        onDelete()
      },
    })
  }
  return <ContextMenu items={items} />
}
