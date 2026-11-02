import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FC } from 'react'
import { BookOpen, FilePlus2, Link2, Search, Trash2 } from 'lucide-react'
import {
  extractLocalDocumentText,
  type ExtractedLocalDocumentText,
} from '../../../services/localDocumentText'
import {
  referenceLibraryService,
  type ProjectReferenceSource,
} from '../../../services/referenceLibraryService'

export interface ReferenceLibraryViewProps {
  projectId: string
}

/** Local source catalog with per-project links; texts are never selected for AI by default. */
export const ReferenceLibraryView: FC<ReferenceLibraryViewProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<ProjectReferenceSource[]>([])
  const [search, setSearch] = useState('')
  const [pendingDocument, setPendingDocument] = useState<ExtractedLocalDocumentText | null>(null)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [busySourceId, setBusySourceId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setEntries(await referenceLibraryService.listProjectSources(projectId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return entries
    return entries.filter(({ source }) =>
      [source.title, source.originalFileName, ...source.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    )
  }, [entries, search])

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setError(null)
    try {
      const extracted = await extractLocalDocumentText(file)
      setPendingDocument(extracted)
      setTitle(file.name.replace(/\.[^.]+$/u, ''))
      setTags('')
    } catch (cause) {
      setPendingDocument(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const saveFile = async () => {
    if (!pendingDocument || busy) return
    setBusy(true)
    setError(null)
    try {
      const source = await referenceLibraryService.createSource({
        extracted: pendingDocument,
        title,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      try {
        await referenceLibraryService.attachToProject(projectId, source.id)
      } catch (cause) {
        await referenceLibraryService.deleteUnlinkedSource(source.id).catch(() => undefined)
        throw cause
      }
      setPendingDocument(null)
      setTitle('')
      setTags('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const toggleProjectLink = async (entry: ProjectReferenceSource, attached: boolean) => {
    setBusySourceId(entry.source.id)
    setError(null)
    try {
      if (attached) await referenceLibraryService.attachToProject(projectId, entry.source.id)
      else await referenceLibraryService.detachFromProject(projectId, entry.source.id)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusySourceId(null)
    }
  }

  const deleteSource = async (sourceId: string) => {
    if (deleteConfirmId !== sourceId) {
      setDeleteConfirmId(sourceId)
      return
    }
    setBusySourceId(sourceId)
    setError(null)
    try {
      await referenceLibraryService.deleteUnlinkedSource(sourceId)
      setDeleteConfirmId(null)
      await refresh()
    } catch (cause) {
      setDeleteConfirmId(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusySourceId(null)
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <section className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <FilePlus2 className="h-4 w-4 text-[var(--ink-accent)]" />
          <h2 className="text-sm font-semibold">导入本地参考资料</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[var(--ink-text-muted)]">
          TXT、Markdown、DOCX 仅在本机提取文字。DOCX
          不保留排版、图片或表格结构；导入后先关联到当前作品，AI 任务仍需逐次勾选才会使用。
        </p>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-3 py-2 text-xs text-[var(--ink-text)] hover:border-[var(--ink-accent)]">
          选择文件
          <input
            data-testid="reference-file-input"
            type="file"
            accept=".txt,.md,.markdown,.docx"
            onChange={(event) => void loadFile(event)}
            className="sr-only"
          />
        </label>
        {pendingDocument && (
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--ink-border)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] text-[var(--ink-text-muted)]">
                <span>资料名称</span>
                <input
                  aria-label="参考资料名称"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2 py-1.5 text-xs text-[var(--ink-text)]"
                />
              </label>
              <label className="space-y-1 text-[11px] text-[var(--ink-text-muted)]">
                <span>分类标签（逗号分隔）</span>
                <input
                  aria-label="参考资料标签"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="都市, 交通"
                  className="w-full rounded border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2 py-1.5 text-xs text-[var(--ink-text)]"
                />
              </label>
            </div>
            <div className="text-[10px] text-[var(--ink-text-faint)]">
              {pendingDocument.fileName} · {pendingDocument.format.toUpperCase()} ·{' '}
              {pendingDocument.text.length.toLocaleString()} 个 UTF-16 字符
            </div>
            {pendingDocument.warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-amber-600">
                {pendingDocument.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-[var(--ink-bg-elevated)] p-2 text-[10px] text-[var(--ink-text-muted)]">
              {pendingDocument.text.slice(0, 1_200)}
              {pendingDocument.text.length > 1_200 ? '…' : ''}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveFile()}
                disabled={busy || !title.trim()}
                className="rounded bg-[var(--ink-accent)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                保存并关联到当前作品
              </button>
              <button
                type="button"
                onClick={() => setPendingDocument(null)}
                disabled={busy}
                className="rounded border border-[var(--ink-border)] px-3 py-1.5 text-xs text-[var(--ink-text-muted)]"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--ink-accent)]" />
            <h2 className="text-sm font-semibold">全局资料目录</h2>
            <span className="text-[10px] text-[var(--ink-text-faint)]">{entries.length} 份</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-text-muted)]" />
            <input
              aria-label="搜索参考资料"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索名称或标签"
              className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] py-1.5 pl-8 pr-2 text-xs text-[var(--ink-text)]"
            />
          </div>
        </div>
        <p className="mb-3 text-[10px] text-[var(--ink-text-faint)]">
          全局目录中的资料可跨作品复用；是否关联到当前作品、以及是否附加到某次 AI
          任务是两个独立选择。
        </p>
        {error && (
          <p role="alert" className="mb-3 text-xs text-rose-500">
            {error}
          </p>
        )}
        {!busy && filteredEntries.length === 0 && (
          <p className="rounded border border-dashed border-[var(--ink-border)] p-4 text-center text-xs text-[var(--ink-text-faint)]">
            {entries.length ? '没有匹配的资料。' : '尚未导入参考资料。'}
          </p>
        )}
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <article
              key={entry.source.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--ink-border)] p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-medium text-[var(--ink-text)]">
                    {entry.source.title}
                  </span>
                  <span className="rounded bg-[var(--ink-bg-elevated)] px-1.5 py-0.5 text-[9px] text-[var(--ink-text-faint)]">
                    {entry.source.format.toUpperCase()}
                  </span>
                  {entry.attached && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600">
                      <Link2 className="h-2.5 w-2.5" /> 已关联当前作品
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[10px] text-[var(--ink-text-faint)]">
                  {entry.source.originalFileName} · {entry.source.text.length.toLocaleString()}{' '}
                  个字符
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.source.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-[var(--ink-bg-elevated)] px-1.5 py-0.5 text-[9px] text-[var(--ink-accent)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[var(--ink-text-muted)]">
                  <input
                    type="checkbox"
                    aria-label={`关联到当前作品 ${entry.source.title}`}
                    checked={entry.attached}
                    disabled={busySourceId === entry.source.id}
                    onChange={(event) => void toggleProjectLink(entry, event.target.checked)}
                    className="accent-[var(--ink-accent)]"
                  />
                  用于本作品
                </label>
                <button
                  type="button"
                  aria-label={
                    deleteConfirmId === entry.source.id
                      ? `确认删除 ${entry.source.title}`
                      : `删除 ${entry.source.title}`
                  }
                  title={
                    entry.attached ? '先解除当前作品关联，再删除未关联资料' : '删除本机资料正文'
                  }
                  disabled={entry.attached || busySourceId === entry.source.id}
                  onClick={() => void deleteSource(entry.source.id)}
                  className="inline-flex items-center gap-1 rounded p-1.5 text-[var(--ink-text-faint)] hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30"
                >
                  {deleteConfirmId === entry.source.id ? '确认' : null}
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {deleteConfirmId === entry.source.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-[10px] text-[var(--ink-text-muted)]"
                  >
                    取消
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {busy && <p className="mt-2 text-[10px] text-[var(--ink-text-faint)]">正在更新资料库…</p>}
      </section>
    </div>
  )
}
