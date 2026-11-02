import { useEffect, useMemo, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react'
import type { ProjectRecord, VolumeRecord } from '../../../types'
import {
  loadManuscriptFile,
  MAX_MANUSCRIPT_FILE_BYTES,
} from '../../../services/manuscriptImportFile'
import type {
  ManuscriptFormat,
  ManuscriptImportPreview,
} from '../../../domain/manuscript/importParser'
import type {
  ManuscriptImportDestination,
  ManuscriptImportProgress,
  ManuscriptImportResult,
} from '../../../services/manuscriptImportService'
import { Modal } from '../../../ui/molecules/Modal'

interface ManuscriptImportDialogProps {
  projects: ProjectRecord[]
  onLoadProjectVolumes: (projectId: string) => Promise<VolumeRecord[]>
  onImport: (
    preview: ManuscriptImportPreview,
    destination: ManuscriptImportDestination,
    onProgress: (progress: ManuscriptImportProgress) => void,
  ) => Promise<ManuscriptImportResult>
  onClose: () => void
}

type DestinationKind = ManuscriptImportDestination['kind']

const PREVIEW_PAGE_SIZE = 100

function formatLabel(format: ManuscriptFormat): string {
  return format === 'docx' ? 'DOCX' : format === 'md' ? 'Markdown' : 'TXT'
}

function selectedCount(preview: ManuscriptImportPreview | null): number {
  return (
    preview?.volumes.reduce(
      (total, volume) => total + volume.chapters.filter((chapter) => chapter.included).length,
      0,
    ) ?? 0
  )
}

export function ManuscriptImportDialog({
  projects,
  onLoadProjectVolumes,
  onImport,
  onClose,
}: ManuscriptImportDialogProps) {
  const [preview, setPreview] = useState<ManuscriptImportPreview | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [destinationKind, setDestinationKind] = useState<DestinationKind>('new-project')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [volumeId, setVolumeId] = useState('')
  const [volumeSnapshot, setVolumeSnapshot] = useState<{
    projectId: string
    volumes: VolumeRecord[]
    error?: string
  } | null>(null)
  const [projectName, setProjectName] = useState('')
  const [genre, setGenre] = useState('')
  const [previewLimit, setPreviewLimit] = useState(PREVIEW_PAGE_SIZE)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<ManuscriptImportProgress | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [result, setResult] = useState<ManuscriptImportResult | null>(null)

  useEffect(() => {
    if (!projectId || destinationKind !== 'existing-volume') return

    let alive = true
    Promise.resolve()
      .then(() => onLoadProjectVolumes(projectId))
      .then((loadedVolumes) => {
        if (!alive) return
        const ordered = [...loadedVolumes].sort((left, right) => left.order - right.order)
        setVolumeSnapshot({ projectId, volumes: ordered })
        setVolumeId((current) =>
          ordered.some((volume) => volume.id === current) ? current : (ordered[0]?.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (!alive) return
        setVolumeSnapshot({
          projectId,
          volumes: [],
          error: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      alive = false
    }
  }, [destinationKind, onLoadProjectVolumes, projectId])

  const chapterEntries = useMemo(
    () =>
      preview?.volumes.flatMap((volume, volumeIndex) =>
        volume.chapters.map((chapter, chapterIndex) => ({
          volume,
          volumeIndex,
          chapter,
          chapterIndex,
        })),
      ) ?? [],
    [preview],
  )
  const visibleEntries = useMemo(
    () => chapterEntries.slice(0, previewLimit),
    [chapterEntries, previewLimit],
  )
  const visibleGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        volume: ManuscriptImportPreview['volumes'][number]
        volumeIndex: number
        entries: typeof visibleEntries
      }
    >()
    for (const entry of visibleEntries) {
      const group = groups.get(entry.volume.sourceKey) ?? {
        volume: entry.volume,
        volumeIndex: entry.volumeIndex,
        entries: [],
      }
      group.entries.push(entry)
      groups.set(entry.volume.sourceKey, group)
    }
    return Array.from(groups.values())
  }, [visibleEntries])
  const includedChapterCount = selectedCount(preview)
  const shouldSelectExistingTarget = destinationKind !== 'new-project'
  const selectedProject = projects.find((project) => project.id === projectId)
  const volumes = volumeSnapshot?.projectId === projectId ? volumeSnapshot.volumes : []
  const volumesLoading =
    destinationKind === 'existing-volume' && !!projectId && volumeSnapshot?.projectId !== projectId
  const volumesError =
    volumeSnapshot?.projectId === projectId ? (volumeSnapshot.error ?? null) : null
  const selectedVolume = volumes.find((volume) => volume.id === volumeId)
  const canImport =
    !!preview &&
    includedChapterCount > 0 &&
    !fileLoading &&
    !volumesLoading &&
    !isImporting &&
    (destinationKind === 'new-project'
      ? projectName.trim().length > 0
      : !!selectedProject &&
        !selectedProject.archivedAt &&
        (destinationKind === 'new-volumes' || !!selectedVolume) &&
        !volumesError)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setFileLoading(true)
    setFileError(null)
    setImportError(null)
    setResult(null)
    setProgress(null)
    setPreview(null)
    setPreviewLimit(PREVIEW_PAGE_SIZE)
    setProjectName(file.name.replace(/\.[^.]+$/, '').trim() || '导入稿件')
    try {
      setPreview(await loadManuscriptFile(file))
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error))
    } finally {
      setFileLoading(false)
    }
  }

  const updateChapter = (
    volumeIndex: number,
    chapterIndex: number,
    patch: { title?: string; included?: boolean },
  ) => {
    setPreview((current) => {
      if (!current) return current
      return {
        ...current,
        volumes: current.volumes.map((volume, currentVolumeIndex) =>
          currentVolumeIndex !== volumeIndex
            ? volume
            : {
                ...volume,
                chapters: volume.chapters.map((chapter, currentChapterIndex) =>
                  currentChapterIndex === chapterIndex ? { ...chapter, ...patch } : chapter,
                ),
              },
        ),
      }
    })
  }

  const updateVolumeTitle = (volumeIndex: number, title: string) => {
    setPreview((current) =>
      current
        ? {
            ...current,
            volumes: current.volumes.map((volume, index) =>
              index === volumeIndex ? { ...volume, title } : volume,
            ),
          }
        : current,
    )
  }

  const handleSelectAll = (included: boolean) => {
    setPreview((current) =>
      current
        ? {
            ...current,
            volumes: current.volumes.map((volume) => ({
              ...volume,
              chapters: volume.chapters.map((chapter) => ({ ...chapter, included })),
            })),
          }
        : current,
    )
  }

  const handleImport = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!preview || !canImport) return
    let destination: ManuscriptImportDestination
    if (destinationKind === 'new-project') {
      destination = { kind: 'new-project', projectName: projectName.trim(), genre }
    } else if (destinationKind === 'new-volumes') {
      destination = { kind: 'new-volumes', projectId }
    } else {
      destination = { kind: 'existing-volume', projectId, volumeId }
    }

    setIsImporting(true)
    setImportError(null)
    setProgress({ completedChapters: 0, totalChapters: includedChapterCount })
    try {
      const imported = await onImport(preview, destination, setProgress)
      setResult(imported)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    if (!isImporting) onClose()
  }

  return (
    <Modal
      title="导入外部稿件"
      onClose={handleClose}
      closeOnBackdrop={!isImporting}
      widthClass="max-w-3xl"
      panelClassName="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--ink-text)]"
    >
      <form className="flex min-h-0 flex-col" onSubmit={(event) => void handleImport(event)}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--ink-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">导入外部稿件</h2>
            <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
              支持 TXT、Markdown 和 DOCX；先预览，再选择本次导入目标。
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            aria-label="关闭导入"
            className="rounded-md p-1 text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {result ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
            >
              <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={17} /> 稿件导入完成
              </div>
              <p className="mt-2 text-sm">
                已将 {result.chapterCount} 章导入《{result.projectName}》，分卷：
                {result.volumeTitles.join('、')}。
              </p>
              <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
                原有内容未被覆盖；导入章节以草稿状态保存。
              </p>
            </div>
          ) : (
            <>
              <section aria-labelledby="manuscript-file-heading" className="space-y-2">
                <h3 id="manuscript-file-heading" className="text-sm font-semibold">
                  1. 选择稿件文件
                </h3>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--ink-border-strong)] bg-[var(--ink-bg-panel)] px-4 py-5 text-sm hover:border-[var(--ink-accent)]">
                  {fileLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  <span>
                    {fileLoading
                      ? '正在读取并解析…'
                      : preview
                        ? '更换文件'
                        : '选择 TXT / MD / DOCX 文件'}
                  </span>
                  <input
                    type="file"
                    aria-label="选择稿件文件"
                    accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    disabled={fileLoading || isImporting}
                    onChange={(event) => void handleFileChange(event)}
                  />
                </label>
                <p className="text-[11px] text-[var(--ink-text-faint)]">
                  文件仅在本机读取，不会上传；最大{' '}
                  {Math.round(MAX_MANUSCRIPT_FILE_BYTES / 1024 / 1024)} MB。
                </p>
                {fileError && (
                  <p
                    role="alert"
                    className="flex items-start gap-1.5 text-xs text-[var(--ink-danger)]"
                  >
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {fileError}
                  </p>
                )}
              </section>

              {preview && (
                <>
                  <section aria-labelledby="manuscript-destination-heading" className="space-y-3">
                    <div>
                      <h3 id="manuscript-destination-heading" className="text-sm font-semibold">
                        2. 选择导入目标
                      </h3>
                      <p className="mt-1 text-[11px] text-[var(--ink-text-muted)]">
                        每次导入都单独选择；现有作品只追加新章节，不覆盖原文。
                      </p>
                    </div>
                    <label className="block space-y-1 text-xs">
                      <span>导入方式</span>
                      <select
                        aria-label="导入方式"
                        value={destinationKind}
                        disabled={isImporting}
                        onChange={(event) =>
                          setDestinationKind(event.target.value as DestinationKind)
                        }
                        className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
                      >
                        <option value="new-project">新建项目</option>
                        <option value="new-volumes" disabled={projects.length === 0}>
                          导入到已有作品的新分卷
                        </option>
                        <option value="existing-volume" disabled={projects.length === 0}>
                          追加到已有作品的指定分卷
                        </option>
                      </select>
                    </label>

                    {destinationKind === 'new-project' ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-xs">
                          <span>新项目名称</span>
                          <input
                            aria-label="新项目名称"
                            value={projectName}
                            maxLength={200}
                            disabled={isImporting}
                            onChange={(event) => setProjectName(event.target.value)}
                            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span>题材（可选）</span>
                          <select
                            aria-label="新项目题材"
                            value={genre}
                            disabled={isImporting}
                            onChange={(event) => setGenre(event.target.value)}
                            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
                          >
                            <option value="">未分类</option>
                            {['东方玄幻', '都市现实', '科幻', '悬疑', '历史', '其他'].map(
                              (item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-xs">
                          <span>目标作品</span>
                          <select
                            aria-label="目标作品"
                            value={projectId}
                            disabled={isImporting || projects.length === 0}
                            onChange={(event) => setProjectId(event.target.value)}
                            className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
                          >
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {destinationKind === 'existing-volume' && (
                          <label className="block space-y-1 text-xs">
                            <span>目标分卷</span>
                            <select
                              aria-label="目标分卷"
                              value={volumeId}
                              disabled={isImporting || volumesLoading || volumes.length === 0}
                              onChange={(event) => setVolumeId(event.target.value)}
                              className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
                            >
                              {volumes.map((volume) => (
                                <option key={volume.id} value={volume.id}>
                                  {volume.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <p className="text-[11px] text-[var(--ink-text-muted)] sm:col-span-2">
                          {destinationKind === 'new-volumes'
                            ? '将为每个含已选章节的源分卷新建分卷，并保留分卷顺序。'
                            : '所有已选章节按原顺序追加到目标分卷；源稿件的分卷边界不会另行创建。'}
                        </p>
                      </div>
                    )}
                    {volumesLoading && (
                      <p className="text-xs text-[var(--ink-text-muted)]">正在读取目标分卷…</p>
                    )}
                    {volumesError && (
                      <p role="alert" className="text-xs text-[var(--ink-danger)]">
                        无法读取目标分卷：{volumesError}
                      </p>
                    )}
                    {selectedProject?.archivedAt && shouldSelectExistingTarget && (
                      <p role="alert" className="text-xs text-[var(--ink-danger)]">
                        该作品已移出作品库，请先恢复后再导入。
                      </p>
                    )}
                  </section>

                  <section aria-labelledby="manuscript-preview-heading" className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 id="manuscript-preview-heading" className="text-sm font-semibold">
                          3. 预览并选择章节
                        </h3>
                        <p className="mt-1 text-[11px] text-[var(--ink-text-muted)]">
                          <FileText size={12} className="mr-1 inline" />
                          {preview.fileName} · {formatLabel(preview.format)} ·{' '}
                          {chapterEntries.length} 章 / {preview.volumes.length} 卷
                        </p>
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => handleSelectAll(true)}
                          className="underline underline-offset-2 disabled:opacity-50"
                        >
                          全选章节
                        </button>
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => handleSelectAll(false)}
                          className="underline underline-offset-2 disabled:opacity-50"
                        >
                          取消全选
                        </button>
                      </div>
                    </div>

                    {preview.warnings.length > 0 && (
                      <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                        {preview.warnings.map((warning, index) => (
                          <li key={`${index}-${warning}`}>{warning}</li>
                        ))}
                      </ul>
                    )}

                    <p className="text-[11px] text-[var(--ink-text-muted)]">
                      已选择 {includedChapterCount} / {chapterEntries.length} 章。
                      {chapterEntries.length > PREVIEW_PAGE_SIZE &&
                        `当前显示 ${visibleEntries.length} 章；展开预览不会影响导入范围。`}
                    </p>
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-3">
                      {visibleGroups.map((group) => (
                        <div key={group.volume.sourceKey} className="space-y-2">
                          {destinationKind !== 'existing-volume' && (
                            <label className="block space-y-1 text-[11px] font-medium text-[var(--ink-text-muted)]">
                              <span>源分卷 {group.volumeIndex + 1}</span>
                              <input
                                aria-label={`分卷标题 ${group.volumeIndex + 1}`}
                                value={group.volume.title}
                                maxLength={200}
                                disabled={isImporting}
                                onChange={(event) =>
                                  updateVolumeTitle(group.volumeIndex, event.target.value)
                                }
                                className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-2.5 py-1.5 text-xs text-[var(--ink-text)]"
                              />
                            </label>
                          )}
                          <ul className="space-y-2">
                            {group.entries.map(({ chapter, chapterIndex }) => {
                              const number =
                                chapterEntries.findIndex(
                                  (entry) => entry.chapter.sourceKey === chapter.sourceKey,
                                ) + 1
                              return (
                                <li
                                  key={chapter.sourceKey}
                                  className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] p-2.5"
                                >
                                  <div className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      aria-label={`导入第 ${number} 章`}
                                      checked={chapter.included}
                                      disabled={isImporting}
                                      onChange={(event) =>
                                        updateChapter(group.volumeIndex, chapterIndex, {
                                          included: event.target.checked,
                                        })
                                      }
                                      className="mt-2 accent-[var(--ink-accent)]"
                                    />
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                      <input
                                        aria-label={`章节标题 ${number}`}
                                        value={chapter.title}
                                        maxLength={200}
                                        disabled={isImporting}
                                        onChange={(event) =>
                                          updateChapter(group.volumeIndex, chapterIndex, {
                                            title: event.target.value,
                                          })
                                        }
                                        className="w-full rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2.5 py-1.5 text-xs font-medium"
                                      />
                                      <p className="whitespace-pre-wrap break-words text-[11px] text-[var(--ink-text-faint)]">
                                        {chapter.content.slice(0, 240)}
                                        {chapter.content.length > 240 ? '…' : ''}
                                      </p>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                      {visibleEntries.length === 0 && (
                        <p className="text-xs text-[var(--ink-text-muted)]">没有可预览的章节。</p>
                      )}
                    </div>
                    {visibleEntries.length < chapterEntries.length && (
                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={() => setPreviewLimit((current) => current + PREVIEW_PAGE_SIZE)}
                        className="w-full rounded-md border border-[var(--ink-border)] px-3 py-2 text-xs text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-50"
                      >
                        显示更多章节（{visibleEntries.length} / {chapterEntries.length}）
                      </button>
                    )}
                  </section>

                  {importError && (
                    <p
                      role="alert"
                      className="flex items-start gap-1.5 text-xs text-[var(--ink-danger)]"
                    >
                      <AlertCircle size={14} className="mt-0.5 shrink-0" /> 稿件未能完整导入：
                      {importError}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ink-border)] px-5 py-3">
          <p aria-live="polite" className="text-xs text-[var(--ink-text-muted)]">
            {isImporting && progress
              ? `正在保存章节 ${progress.completedChapters} / ${progress.totalChapters}…`
              : result
                ? '导入完成。'
                : preview
                  ? `已选择 ${includedChapterCount} 章。`
                  : '不会覆盖已有章节。'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="rounded-md border border-[var(--ink-border)] px-3 py-2 text-xs hover:bg-[var(--ink-bg-hover)] disabled:opacity-50"
            >
              {result ? '完成' : '取消'}
            </button>
            {!result && (
              <button
                type="submit"
                disabled={!canImport}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ink-accent)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--ink-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting && <Loader2 size={13} className="animate-spin" />}
                {isImporting ? '正在导入…' : `导入 ${includedChapterCount} 章`}
              </button>
            )}
          </div>
        </footer>
      </form>
    </Modal>
  )
}
