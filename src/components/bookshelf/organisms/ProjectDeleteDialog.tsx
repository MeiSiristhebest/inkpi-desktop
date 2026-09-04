import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import type { ProjectRecord } from '../../../types'

interface ProjectDeleteDialogProps {
  project: ProjectRecord | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 删除作品二次确认弹窗（原子设计 · organisms）。
 * 复用通用 ConfirmDialog 分子，自身只承载「删除作品」这一具体文案（§10/§11）。
 */
export const ProjectDeleteDialog = ({ project, onCancel, onConfirm }: ProjectDeleteDialogProps) => (
  <ConfirmDialog
    open={!!project}
    title="删除作品"
    danger
    confirmText="确认删除"
    onConfirm={onConfirm}
    onCancel={onCancel}
  >
    {project && (
      <>
        <p className="text-[13.5px] text-[var(--ink-text)]">
          确定要删除《<span className="font-semibold text-[var(--ink-danger)]">{project.name}</span>》吗？
        </p>
        <p className="text-[11.5px] text-[var(--ink-text-muted)] leading-relaxed">
          全书的大纲设定、人物卡与已撰正文将一并删除，不可撤销。建议删除前先导出备份。
        </p>
      </>
    )}
  </ConfirmDialog>
)
