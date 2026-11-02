import { useState, type FC } from 'react'
import { FileText } from 'lucide-react'
import type { PluginBookshelfActionProps } from '../../../types/plugin'
import { ManuscriptImportDialog } from './ManuscriptImportDialog'

export const ManuscriptImportBookshelfAction: FC<PluginBookshelfActionProps> = (props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="导入稿件"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-3.5 text-[12.5px] font-medium text-[var(--ink-text)] shadow-2xs transition-colors hover:bg-[var(--ink-bg-hover)]"
      >
        <FileText size={13} /> 导入稿件
      </button>
      {open && (
        <ManuscriptImportDialog
          projects={props.projects}
          onLoadProjectVolumes={props.onLoadProjectVolumes}
          onImport={props.onImportManuscript}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
