import type { FC } from 'react'
import { FileText } from 'lucide-react'
import type { DesktopPluginViewProps } from '../../../types/plugin'

export const ManuscriptImportMasterView: FC<DesktopPluginViewProps> = ({ onBackToLibrary }) => (
  <main className="h-full overflow-y-auto bg-[var(--ink-bg)] p-6 text-[var(--ink-text)]">
    <section className="mx-auto max-w-2xl space-y-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[var(--ink-accent)]" />
        <h1 className="text-base font-semibold">稿件导入</h1>
      </div>
      <p className="text-sm text-[var(--ink-text-muted)]">
        支持 TXT、Markdown 和 DOCX。请在作品库中打开“导入稿件”，预览并选择要导入的章节及目标作品。
      </p>
      <p className="text-xs text-[var(--ink-text-faint)]">
        文件只在本机读取；导入前可调整章节标题与选择范围。DOCX 的部分排版可能无法保留。
      </p>
      {onBackToLibrary && (
        <button
          type="button"
          onClick={onBackToLibrary}
          className="rounded-md bg-[var(--ink-accent)] px-3 py-1.5 text-xs font-medium text-white"
        >
          返回作品库并导入
        </button>
      )}
    </section>
  </main>
)
