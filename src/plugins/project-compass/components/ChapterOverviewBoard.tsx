import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { projectChapterSequence } from '../../../domain/chapter/chapterSequence'
import type { ChapterRecord, VolumeRecord } from '../../../types'

interface ChapterOverviewBoardProps {
  projectId: string
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  loading: boolean
  onOpenChapter: (chapterId: string) => void
}

type ChapterStatusFilter = 'all' | 'draft' | 'review' | 'published' | 'archived'

const PAGE_SIZE = 40

function statusFor(chapter: ChapterRecord): ChapterStatusFilter {
  const status = chapter.status as string | undefined
  if (status === 'review' || status === '审阅中') return 'review'
  if (status === 'published' || status === '完稿' || status === '已发布') return 'published'
  if (status === 'archived' || status === '已归档') return 'archived'
  return 'draft'
}

function statusLabel(status: ChapterStatusFilter): string {
  switch (status) {
    case 'review':
      return '审阅中'
    case 'published':
      return '完稿'
    case 'archived':
      return '已归档'
    default:
      return '草稿'
  }
}

export function ChapterOverviewBoard({
  projectId,
  volumes,
  chapters,
  loading,
  onOpenChapter,
}: ChapterOverviewBoardProps) {
  const [query, setQuery] = useState('')
  const [volumeFilter, setVolumeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ChapterStatusFilter>('all')
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)

  const volumeById = useMemo(() => new Map(volumes.map((volume) => [volume.id, volume])), [volumes])
  const orderedVolumes = useMemo(
    () =>
      volumes.filter((volume) => volume.projectId === projectId).sort((a, b) => a.order - b.order),
    [projectId, volumes],
  )
  const sequence = useMemo(
    () => projectChapterSequence(projectId, chapters, volumes),
    [chapters, projectId, volumes],
  )
  const filteredChapters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return sequence.filter((chapter) => {
      if (volumeFilter !== 'all' && chapter.volumeId !== volumeFilter) return false
      if (statusFilter !== 'all' && statusFor(chapter) !== statusFilter) return false
      if (!normalizedQuery) return true
      const volumeTitle = volumeById.get(chapter.volumeId)?.title ?? ''
      return `${chapter.title} ${volumeTitle} ${chapter.synopsis ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    })
  }, [query, sequence, statusFilter, volumeById, volumeFilter])
  const visibleChapters = filteredChapters.slice(0, visibleLimit)

  const resetAndSetQuery = (value: string) => {
    setVisibleLimit(PAGE_SIZE)
    setQuery(value)
  }
  const resetAndSetVolume = (value: string) => {
    setVisibleLimit(PAGE_SIZE)
    setVolumeFilter(value)
  }
  const resetAndSetStatus = (value: ChapterStatusFilter) => {
    setVisibleLimit(PAGE_SIZE)
    setStatusFilter(value)
  }

  return (
    <section
      aria-labelledby="chapter-overview-title"
      data-testid="chapter-overview-board"
      className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="chapter-overview-title"
            className="text-[14px] font-semibold text-[var(--ink-text)]"
          >
            章节总览
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-text-faint)]">
            来自本作品的真实章节记录；可按标题、分卷或摘要搜索，选择章节可直接打开编辑器。
          </p>
        </div>
        <span className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2 py-1 text-[11px] text-[var(--ink-text-muted)]">
          {loading ? '读取中…' : `${filteredChapters.length} / ${sequence.length} 章`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)]">
        <label className="relative block">
          <span className="sr-only">搜索章节</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-text-faint)]"
          />
          <input
            aria-label="搜索章节"
            type="search"
            value={query}
            disabled={loading}
            onChange={(event) => resetAndSetQuery(event.target.value)}
            placeholder="搜索章节、分卷或摘要"
            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] py-2 pl-8 pr-3 text-xs"
          />
        </label>
        <label className="block">
          <span className="sr-only">按分卷筛选</span>
          <select
            aria-label="按分卷筛选"
            value={volumeFilter}
            disabled={loading}
            onChange={(event) => resetAndSetVolume(event.target.value)}
            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-xs"
          >
            <option value="all">全部分卷</option>
            {orderedVolumes.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {volume.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">按状态筛选</span>
          <select
            aria-label="按状态筛选"
            value={statusFilter}
            disabled={loading}
            onChange={(event) => resetAndSetStatus(event.target.value as ChapterStatusFilter)}
            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-xs"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="review">审阅中</option>
            <option value="published">完稿</option>
            <option value="archived">已归档</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="rounded-lg border border-dashed border-[var(--ink-border)] px-3 py-6 text-center text-xs text-[var(--ink-text-muted)]">
          正在读取本作品章节…
        </p>
      ) : sequence.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--ink-border)] px-3 py-6 text-center text-xs text-[var(--ink-text-muted)]">
          本作品还没有章节记录。
        </p>
      ) : filteredChapters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--ink-border)] px-3 py-6 text-center text-xs text-[var(--ink-text-muted)]">
          没有符合当前搜索和筛选条件的章节。
        </p>
      ) : (
        <>
          <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto" aria-label="章节列表">
            {visibleChapters.map((chapter) => {
              const volumeTitle = volumeById.get(chapter.volumeId)?.title ?? '未分卷'
              const status = statusFor(chapter)
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    aria-label={`在章节总览中打开《${chapter.title}》正文`}
                    onClick={() => onOpenChapter(chapter.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-[var(--ink-bg-elevated)] px-3 py-2 text-left hover:border-[var(--ink-accent)] transition-colors"
                  >
                    <span className="w-12 shrink-0 text-[10px] tabular-nums text-[var(--ink-text-faint)]">
                      {chapter.chapterNumber ? `第 ${chapter.chapterNumber} 章` : '未排序'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[var(--ink-text)]">
                        {chapter.title}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--ink-text-faint)]">
                        {volumeTitle}
                        {chapter.synopsis?.trim() ? ` · ${chapter.synopsis.trim()}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-[var(--ink-border)] px-2 py-0.5 text-[10px] text-[var(--ink-text-muted)]">
                      {statusLabel(status)}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-[var(--ink-text-faint)]">
                      {(chapter.wordCount || 0).toLocaleString()} 字
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {visibleChapters.length < filteredChapters.length && (
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
              className="w-full rounded-md border border-[var(--ink-border)] px-3 py-2 text-xs text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
            >
              显示更多章节（{visibleChapters.length} / {filteredChapters.length}）
            </button>
          )}
        </>
      )}
    </section>
  )
}
