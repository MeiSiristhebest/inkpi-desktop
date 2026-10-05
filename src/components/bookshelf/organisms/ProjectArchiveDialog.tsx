import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import type { ProjectRecord } from '../../../types'

interface ProjectArchiveDialogProps {
  project: ProjectRecord | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 移出作品库确认弹窗（原子设计 · organisms）。
 * 非破坏操作：正文、设定、插件与 AI 数据都不动，只是不再出现在书架（P0.8 / INV-01）。
 */
export const ProjectArchiveDialog = ({
  project,
  onCancel,
  onConfirm,
}: ProjectArchiveDialogProps) => (
  <ConfirmDialog
    open={!!project}
    title="移出作品库"
    confirmText="移出作品库"
    onConfirm={onConfirm}
    onCancel={onCancel}
  >
    {project && (
      <>
        <p className="text-[13.5px] text-[var(--ink-text)]">
          把《<span className="font-semibold">{project.name}</span>》移出作品库？
        </p>
        <p className="text-[11.5px] text-[var(--ink-text-muted)] leading-relaxed">
          作品数据会<strong>完整保留</strong>在本地，不会删除任何正文或设定。
          之后可以在书架下方「已移出作品库」里放回。
        </p>
      </>
    )}
  </ConfirmDialog>
)
