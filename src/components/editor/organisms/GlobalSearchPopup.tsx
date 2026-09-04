import { BookOpen, X } from 'lucide-react'
import { IconButton } from '../../../ui/atoms/IconButton'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface GlobalSearchPopupProps {
  model: EditorModel
}

/** 全书检索浮层（跨章节核心功能，非插件）。organisms 层，仅声明式渲染。 */
export const GlobalSearchPopup: React.FC<GlobalSearchPopupProps> = ({ model }) => {
  const { showGlobalSearch, globalQuery, globalResults, actions } = model
  if (!showGlobalSearch) return null
  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center pt-[12vh] bg-black/30"
      onClick={() => actions.setShowGlobalSearch(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] max-h-[70vh] flex flex-col rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] shadow-[var(--ink-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ink-border)]">
          <BookOpen className="w-4 h-4 text-[var(--ink-accent)] shrink-0" />
          <input
            autoFocus
            value={globalQuery}
            onChange={(e) => actions.setGlobalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') actions.runGlobalSearch()
            }}
            placeholder="检索全书所有章节…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--ink-text-faint)]"
          />
          <IconButton onClick={() => actions.setShowGlobalSearch(false)}>
            <X className="w-4 h-4" />
          </IconButton>
        </div>
        <div className="flex items-center justify-between px-4 py-1.5 text-[11px] text-[var(--ink-text-faint)] border-b border-[var(--ink-border)]">
          <span>{globalResults.length} 个章节命中</span>
          <button
            onClick={() => actions.runGlobalSearch()}
            className="text-[var(--ink-accent)] hover:underline"
          >
            检索
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {globalResults.length === 0 && globalQuery.trim() && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--ink-text-faint)]">
              未找到匹配
            </div>
          )}
          {globalResults.map((r) => (
            <button
              key={r.chapterId}
              onClick={() => actions.jumpToChapterFromSearch(r)}
              className="w-full text-left px-4 py-2.5 border-b border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-[var(--ink-text)] truncate">{r.title}</span>
                <span className="text-[10px] text-[var(--ink-text-faint)] shrink-0 tabular-nums">
                  {r.count} 处
                </span>
              </div>
              <div className="text-[11px] text-[var(--ink-text-faint)] mt-0.5 truncate">
                …{r.snippet}…
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
