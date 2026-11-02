import { useEffect, useMemo, useState, type FC } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { indexedDbFormDataRepository } from '../../../adapters/indexedDbFormDataRepository'
import { indexedDbSettingsKVRepository } from '../../../adapters/indexedDbSettingsKVRepository'
import {
  deriveProjectStartSuggestions,
  emptyProjectStartGuideState,
  parseProjectStartGuideState,
  type ProjectStartGuideDisposition,
  type ProjectStartGuideState,
  type ProjectStartGuideSuggestionId,
} from '../domain/projectStartGuide'
import type { ChapterRecord, ProjectRecord, VolumeRecord } from '../../../types'

export const PROJECT_START_GUIDE_STORAGE_KEY = 'projectStartGuideState'

interface ProjectStartGuideProps {
  projectId: string
  project?: ProjectRecord
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  onOpenView: (view: string) => void
}

interface LoadedGuide {
  projectId: string
  state: ProjectStartGuideState
  positioningData: Record<string, unknown>
  worldbaseData: Record<string, unknown>
}

interface ScopedMessage {
  projectId: string
  message: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const ProjectStartGuide: FC<ProjectStartGuideProps> = (props) => (
  <ProjectStartGuideContent key={props.projectId} {...props} />
)

const ProjectStartGuideContent: FC<ProjectStartGuideProps> = ({
  projectId,
  project,
  volumes,
  chapters,
  onOpenView,
}) => {
  const [loaded, setLoaded] = useState<LoadedGuide | null>(null)
  const [loadError, setLoadError] = useState<ScopedMessage | null>(null)
  const [saveError, setSaveError] = useState<ScopedMessage | null>(null)
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      indexedDbFormDataRepository.getFormData(projectId, 'positioning'),
      indexedDbFormDataRepository.getFormData(projectId, 'worldbase'),
      indexedDbSettingsKVRepository.get<unknown>(projectId, PROJECT_START_GUIDE_STORAGE_KEY, null),
    ])
      .then(([positioningData, worldbaseData, storedState]) => {
        if (!alive) return
        setLoaded({
          projectId,
          state:
            storedState === null
              ? emptyProjectStartGuideState()
              : parseProjectStartGuideState(storedState),
          positioningData,
          worldbaseData,
        })
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setLoadError({ projectId, message: errorMessage(error) })
      })

    return () => {
      alive = false
    }
  }, [projectId, loadAttempt])

  const currentGuide = loaded?.projectId === projectId ? loaded : null
  const currentLoadError = loadError?.projectId === projectId ? loadError : null
  const currentSaveError = saveError?.projectId === projectId ? saveError : null
  const loading = !currentGuide && !currentLoadError
  const suggestions = useMemo(
    () =>
      deriveProjectStartSuggestions({
        projectId,
        project,
        volumes,
        chapters,
        positioningData: currentGuide?.positioningData,
        worldbaseData: currentGuide?.worldbaseData,
      }),
    [
      chapters,
      currentGuide?.positioningData,
      currentGuide?.worldbaseData,
      project,
      projectId,
      volumes,
    ],
  )

  const updateDisposition = async (
    suggestionId: ProjectStartGuideSuggestionId,
    disposition: ProjectStartGuideDisposition | undefined,
  ) => {
    if (!currentGuide || savingProjectId === projectId) return
    const dispositions = { ...currentGuide.state.dispositions }
    if (disposition) {
      dispositions[suggestionId] = disposition
    } else {
      delete dispositions[suggestionId]
    }
    const nextState: ProjectStartGuideState = { version: 1, dispositions }

    setSavingProjectId(projectId)
    setSaveError(null)
    try {
      await indexedDbSettingsKVRepository.set(projectId, PROJECT_START_GUIDE_STORAGE_KEY, nextState)
      setLoaded((current) =>
        current?.projectId === projectId ? { ...current, state: nextState } : current,
      )
    } catch (error) {
      setSaveError({ projectId, message: errorMessage(error) })
    } finally {
      setSavingProjectId((current) => (current === projectId ? null : current))
    }
  }

  const activeSuggestions = suggestions.filter(
    (suggestion) => !currentGuide?.state.dispositions[suggestion.id],
  )
  const deferredSuggestions = suggestions.filter(
    (suggestion) => currentGuide?.state.dispositions[suggestion.id] === 'deferred',
  )
  const ignoredSuggestions = suggestions.filter(
    (suggestion) => currentGuide?.state.dispositions[suggestion.id] === 'ignored',
  )
  const saving = savingProjectId === projectId

  return (
    <section
      aria-labelledby="project-start-guide-title"
      data-testid="project-start-guide"
      className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 space-y-3"
    >
      <div>
        <h2
          id="project-start-guide-title"
          className="text-[14px] font-semibold text-[var(--ink-text)]"
        >
          项目起步建议
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--ink-text-faint)]">
          根据本作品的定位表、世界设定、分卷和章节记录生成；暂缓与忽略状态只保存为本作品的查看偏好。
        </p>
      </div>

      {loading && (
        <p className="text-[12px] text-[var(--ink-text-muted)]">正在读取本作品的起步状态…</p>
      )}
      {currentLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-rose-500">读取起步状态失败：{currentLoadError.message}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError(null)
              setLoaded(null)
              setLoadAttempt((attempt) => attempt + 1)
            }}
            className="rounded border border-[var(--ink-border)] px-2 py-1 text-[var(--ink-text-muted)]"
          >
            重试
          </button>
        </div>
      )}
      {currentSaveError && (
        <p role="alert" className="text-xs text-rose-500">
          保存查看偏好失败：{currentSaveError.message}。当前建议未更改。
        </p>
      )}

      {currentGuide && (
        <>
          {activeSuggestions.length === 0 &&
            deferredSuggestions.length === 0 &&
            ignoredSuggestions.length === 0 && (
              <p className="text-[12px] text-[var(--ink-text-muted)]">
                当前没有待完成的起步建议；作品资料更新后会自动重新判断。
              </p>
            )}

          {activeSuggestions.length > 0 && (
            <ul className="space-y-2" aria-label="待完成的起步建议">
              {activeSuggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  data-testid={`project-start-suggestion-${suggestion.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3"
                >
                  <div className="min-w-48 flex-1">
                    <h3 className="text-xs font-medium text-[var(--ink-text)]">
                      {suggestion.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-text-muted)]">
                      {suggestion.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenView(suggestion.targetView)}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--ink-accent-soft)] px-2.5 py-1.5 text-[11px] text-[var(--ink-accent)]"
                  >
                    {suggestion.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`暂缓建议：${suggestion.title}`}
                    disabled={saving}
                    onClick={() => void updateDisposition(suggestion.id, 'deferred')}
                    className="rounded-md border border-[var(--ink-border)] px-2 py-1.5 text-[11px] text-[var(--ink-text-muted)] disabled:opacity-50"
                  >
                    稍后
                  </button>
                  <button
                    type="button"
                    aria-label={`忽略建议：${suggestion.title}`}
                    disabled={saving}
                    onClick={() => void updateDisposition(suggestion.id, 'ignored')}
                    className="rounded-md border border-[var(--ink-border)] px-2 py-1.5 text-[11px] text-[var(--ink-text-muted)] disabled:opacity-50"
                  >
                    忽略
                  </button>
                </li>
              ))}
            </ul>
          )}

          {deferredSuggestions.length > 0 && (
            <div className="space-y-1.5" aria-label="稍后再看">
              <h3 className="text-[11px] font-medium text-[var(--ink-text-muted)]">
                稍后再看 ({deferredSuggestions.length})
              </h3>
              {deferredSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-text-muted)]">
                    {suggestion.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`恢复建议：${suggestion.title}`}
                    disabled={saving}
                    onClick={() => void updateDisposition(suggestion.id, undefined)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--ink-border)] px-2 py-1 text-[var(--ink-text-muted)] disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}

          {ignoredSuggestions.length > 0 && (
            <div className="space-y-1.5" aria-label="已跳过的建议">
              <h3 className="text-[11px] font-medium text-[var(--ink-text-muted)]">
                已跳过建议 ({ignoredSuggestions.length})
              </h3>
              {ignoredSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-text-muted)]">
                    {suggestion.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`恢复建议：${suggestion.title}`}
                    disabled={saving}
                    onClick={() => void updateDisposition(suggestion.id, undefined)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--ink-border)] px-2 py-1 text-[var(--ink-text-muted)] disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
