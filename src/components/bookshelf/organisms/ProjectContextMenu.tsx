import { Pencil, Upload, FileText, Archive, Trash2 } from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '../../../ui/molecules/ContextMenu'

interface ProjectContextMenuProps {
  hasUpdate: boolean
  hasExport: boolean
  onClose: () => void
  onEdit: () => void
  /** 完整工作区备份：含设定、时间线、插件与 AI 数据 */
  onExport: () => void
  /** 纯正文导出：只有分卷与章节文本 */
  onExportManuscript: () => void
  /** 只隐藏书架条目，数据保留 */
  onRemoveFromLibrary: () => void
  /** 不可撤销的 purge */
  onDelete: () => void
}

const pick = (handler: () => void, close: () => void) => () => {
  close()
  handler()
}

/**
 * 作品卡片右上角的「更多操作」气泡菜单（原子设计 · organisms）。
 * 条目以配置驱动，复用通用 ContextMenu 分子（§10/§11）；菜单开关状态由父级 ProjectCard 持有。
 * 两种导出与两种「删除」语义分开列出，避免同一个回调挂两个标签（INV-09）。
 */
export const ProjectContextMenu = ({
  hasUpdate,
  hasExport,
  onClose,
  onEdit,
  onExport,
  onExportManuscript,
  onRemoveFromLibrary,
  onDelete,
}: ProjectContextMenuProps) => {
  const items: ContextMenuItem[] = []
  if (hasUpdate) {
    items.push({
      key: 'edit',
      label: '编辑信息',
      icon: <Pencil size={13} />,
      onClick: pick(onEdit, onClose),
    })
  }
  if (hasExport) {
    items.push({
      key: 'export',
      label: '导出完整备份',
      icon: <Upload size={13} />,
      onClick: pick(onExport, onClose),
    })
    items.push({
      key: 'exportManuscript',
      label: '导出正文',
      icon: <FileText size={13} />,
      onClick: pick(onExportManuscript, onClose),
    })
  }
  if (hasUpdate) {
    items.push({
      key: 'archive',
      label: '移出作品库',
      icon: <Archive size={13} />,
      dividerBefore: true,
      onClick: pick(onRemoveFromLibrary, onClose),
    })
    items.push({
      key: 'delete',
      label: '永久删除',
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: pick(onDelete, onClose),
    })
  }
  return <ContextMenu items={items} onClose={onClose} />
}
