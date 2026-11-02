import { useCallback, useEffect, useState, type FC } from 'react'
import { BookOpen, ChevronDown, RefreshCw } from 'lucide-react'
import { referenceLibraryService } from '../../../services/referenceLibraryService'
import type { ReferenceSourceRecord } from '../../../domain/references/referenceMaterials'

export interface ReferenceMaterialPickerProps {
  projectId: string
  selectedSourceIds: string[]
  onChange: (sourceIds: string[]) => void
  disabled?: boolean
  testId?: string
}

/** Per-task picker: linked source texts remain out of the request until checked for this run. */
export const ReferenceMaterialPicker: FC<ReferenceMaterialPickerProps> = ({
  projectId,
  selectedSourceIds,
  onChange,
  disabled = false,
  testId = 'reference-material-picker',
}) => {
  const [sources, setSources] = useState<ReferenceSourceRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) {
      setSources([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const items = await referenceLibraryService.listProjectSources(projectId)
      const linkedSources = items.filter((item) => item.attached).map((item) => item.source)
      setSources(linkedSources)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const linkedIds = new Set(sources.map((source) => source.id))
    const nextSelection = selectedSourceIds.filter((id) => linkedIds.has(id))
    if (nextSelection.length !== selectedSourceIds.length) onChange(nextSelection)
  }, [onChange, selectedSourceIds, sources])

  const selected = new Set(selectedSourceIds)
  const toggleSource = (sourceId: string, checked: boolean) => {
    onChange(
      checked
        ? [...new Set([...selectedSourceIds, sourceId])]
        : selectedSourceIds.filter((id) => id !== sourceId),
    )
  }

  return (
    <section data-testid={testId} className="rounded border border-[var(--ink-border)] px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          disabled={disabled}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-medium text-[var(--ink-text)]"
        >
          <BookOpen className="h-3 w-3 shrink-0 text-[var(--ink-accent)]" />
          <span>本次 AI 参考资料</span>
          <span className="text-[var(--ink-text-faint)]">
            {selectedSourceIds.length}/{sources.length} 已选
          </span>
          <ChevronDown
            className={`ml-auto h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          type="button"
          aria-label="刷新参考资料"
          onClick={() => void refresh()}
          disabled={loading || disabled}
          className="rounded p-1 text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-[var(--ink-text-faint)]">
        默认不附带；只把本次勾选资料中命中的摘录用于任务，下一次需重新选择。
      </p>
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-[var(--ink-border)] pt-2">
          {error && (
            <p role="alert" className="text-[10px] text-rose-500">
              {error}
            </p>
          )}
          {!error && sources.length === 0 && (
            <p className="text-[10px] text-[var(--ink-text-muted)]">
              当前作品没有关联参考资料。请先到“素材资料库”导入并关联资料。
            </p>
          )}
          {sources.map((source) => (
            <label
              key={source.id}
              className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-[var(--ink-bg-hover)]"
            >
              <input
                type="checkbox"
                aria-label={`选择参考资料 ${source.title}`}
                checked={selected.has(source.id)}
                onChange={(event) => toggleSource(source.id, event.target.checked)}
                disabled={disabled}
                className="mt-0.5 accent-[var(--ink-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-[var(--ink-text)]">
                  {source.title}
                </span>
                <span className="block truncate text-[10px] text-[var(--ink-text-faint)]">
                  {source.format.toUpperCase()} · {source.tags.join(' · ') || '未分类'}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
