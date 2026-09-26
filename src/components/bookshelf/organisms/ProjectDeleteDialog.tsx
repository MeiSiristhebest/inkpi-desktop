import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import type { ProjectRecord } from '../../../types'

interface ProjectDeleteDialogProps {
  project: ProjectRecord | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 永久删除二次确认弹窗（原子设计 · organisms）。
 * 与「移出作品库」是两种语义：这里只做不可撤销的 purge，文案必须如实说明清除范围（INV-04）。
 */
export const ProjectDeleteDialog = ({ project, onCancel, onConfirm }: ProjectDeleteDialogProps) => (
  <ConfirmDialog
    open={!!project}
    title="永久删除作品"
    danger
    confirmText="永久删除"
    onConfirm={onConfirm}
    onCancel={onCancel}
  >
    {project && (
      <>
        <p className="text-[13.5px] text-[var(--ink-text)]">
          确定要永久删除《
          <span className="font-semibold text-[var(--ink-danger)]">{project.name}</span>
          》吗？
        </p>
        <p className="text-[11.5px] text-[var(--ink-text-muted)] leading-relaxed">
          这会清除该作品的<strong>全部</strong>
          本地数据：正文与分卷、设定集、时间线、伏笔、插件记录、 AI 产物与历史快照，并同步清除
          Runtime 侧的投影与检索索引。操作不可撤销。
        </p>
        <p className="text-[11.5px] text-[var(--ink-text-muted)] leading-relaxed">
          只是不想在书架看到它？请改用「移出作品库」—— 数据完整保留，随时可以放回。
        </p>
      </>
    )}
  </ConfirmDialog>
)
