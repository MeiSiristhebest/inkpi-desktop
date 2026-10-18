import { matchesSerializedResult } from '../../../domain/serializedResult'
import { redactPluginValue } from '../../../core/pluginDataRedaction'
import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { MemoryPalaceEngine, MemoryPalaceWorkspaceIndex } from '../engine/MemoryPalaceEngine'
import type { EntitySearchResult } from '../types'
import { Sparkles, Search, History, BookmarkCheck, BookOpen } from 'lucide-react'
import { indexedDbMemoryPalaceRepository } from '../../../adapters/indexedDbMemoryPalaceRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { projectSemanticTextFields, semanticTextFromContent } from '../../../domain/content'
import { chapterSaveEvents } from '../../../ports/chapterSaveEvents'

export const MemoryPalaceMasterView: FC<DesktopPluginViewProps> = (props) => (
  <MemoryPalaceSession key={props.projectId} {...props} />
)
const MemoryPalaceSession: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const host = useOptionalPluginHostContext()
  const [entities, setEntities] = useState<any[]>([])
  const [chapters, setChapters] = useState<any[]>([])
  const [volumes, setVolumes] = useState<import('../../../types').VolumeRecord[]>([])
  const [storageError, setStorageError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)
  const indexRef = useRef<MemoryPalaceWorkspaceIndex | null>(null)
  const pendingSavedChaptersRef = useRef(new Map<string, any>())
  const requestVersionRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    pendingSavedChaptersRef.current.clear()
    setLoading(true)
    void Promise.all([
      indexedDbCodexEntityRepository.getAll(),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject?.(projectId) ?? Promise.resolve([]),
    ])
      .then(([allEnts, allChs, allVolumes]) => {
        if (cancelled) return
        const projectEnts = (allEnts || []).filter((e) => e.projectId === projectId)
        const mergedChapters = [...(allChs || [])]
        const chapterIds = new Set(mergedChapters.map((chapter) => chapter.id))
        for (const [chapterId, chapter] of pendingSavedChaptersRef.current) {
          const index = mergedChapters.findIndex((item) => item.id === chapterId)
          if (index >= 0) mergedChapters[index] = chapter
          else if (!chapterIds.has(chapterId)) mergedChapters.push(chapter)
        }
        setStorageError(null)
        setVolumes(allVolumes)
        setEntities(projectEnts)
        setChapters(mergedChapters)
        const index = new MemoryPalaceWorkspaceIndex(projectId)
        index.setVolumes(allVolumes)
        index.updateMany(mergedChapters)
        indexRef.current = index
      })
      .catch((error) => {
        if (!cancelled) setStorageError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      indexRef.current = null
    }
  }, [projectId, loadAttempt])

  useEffect(() => {
    return chapterSaveEvents.subscribe(({ chapter }) => {
      if (chapter.projectId !== projectId) return
      pendingSavedChaptersRef.current.set(chapter.id, chapter)
      indexRef.current?.update(chapter)
      setChapters((current) => {
        const existing = current.some((item) => item.id === chapter.id)
        return existing
          ? current.map((item) => (item.id === chapter.id ? chapter : item))
          : [...current, chapter]
      })
    })
  }, [projectId])

  const localSearchResults: EntitySearchResult[] = useMemo(() => {
    const index = indexRef.current
    return index
      ? index.search(query, entities)
      : MemoryPalaceEngine.searchEntityOccurrences({
          query,
          entities,
          chapters,
          volumes,
          projectId,
        })
  }, [query, entities, chapters, volumes, projectId])
  const runtimeChapters = useMemo(
    () =>
      chapters.map((chapter) => ({
        ...chapter,
        content: semanticTextFromContent(chapter.id, chapter.content || '', chapter.revision),
      })),
    [chapters],
  )
  const runtimeSearchInput = useMemo(() => {
    const input = {
      workspaceId: projectId,
      query,
      entities,
      chapters: runtimeChapters,
      volumes,
      index: {
        mode: 'jit-incremental' as const,
        chapterIds: runtimeChapters.map((chapter) => chapter.id),
      },
    }
    return projectSemanticTextFields(input) as typeof input
  }, [projectId, query, entities, runtimeChapters, volumes])
  const [runtimeRun, setRuntimeRun] = useState<{
    input: string
    result: EntitySearchResult[]
  } | null>(null)
  const searchInput = JSON.stringify(runtimeSearchInput)
  const runtimeSearchResults = runtimeRun?.input === searchInput ? runtimeRun.result : null
  const [runtimeSearchStatus, setRuntimeSearchStatus] = useState<
    'unavailable' | 'loading' | 'ready' | 'failed'
  >('unavailable')
  const [runtimeSearchError, setRuntimeSearchError] = useState<string | null>(null)
  const [runtimeSearchRetry, setRuntimeSearchRetry] = useState(0)
  const runtimeAssistant = host?.aiAssistant
  const runtimeSearchAvailable = Boolean(
    runtimeAssistant?.isAvailable && runtimeAssistant.runPluginTool,
  )

  useEffect(() => {
    if (!runtimeSearchAvailable || !runtimeAssistant?.runPluginTool) {
      setRuntimeRun(null)
      setRuntimeSearchStatus('unavailable')
      setRuntimeSearchError(null)
      return
    }

    const runPluginTool = runtimeAssistant.runPluginTool
    const requestVersion = ++requestVersionRef.current
    let cancelled = false
    setRuntimeRun(null)
    setRuntimeSearchStatus('loading')
    setRuntimeSearchError(null)
    const dispatchSearch = () => {
      void runPluginTool('memory-palace', runtimeSearchInput)
        .then((result) => {
          if (
            !cancelled &&
            requestVersion === requestVersionRef.current &&
            isEntitySearchResults(result) &&
            matchesSerializedResult(result, redactPluginValue(localSearchResults))
          ) {
            setRuntimeRun({ input: searchInput, result })
            setRuntimeSearchStatus('ready')
          } else if (!cancelled && requestVersion === requestVersionRef.current) {
            setRuntimeSearchError('Runtime 返回了无法识别的检索结果。')
            setRuntimeSearchStatus('failed')
          }
        })
        .catch((error: unknown) => {
          if (cancelled || requestVersion !== requestVersionRef.current) return
          setRuntimeSearchError(error instanceof Error ? error.message : '未知错误')
          setRuntimeSearchStatus('failed')
        })
    }
    const timer = window.setTimeout(dispatchSearch, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    entities,
    volumes,
    searchInput,
    localSearchResults,
    projectId,
    query,
    runtimeAssistant,
    runtimeChapters,
    runtimeSearchAvailable,
    runtimeSearchRetry,
  ])

  const searchResults = runtimeSearchResults ?? localSearchResults

  const handleSaveSnapshot = async (res: EntitySearchResult) => {
    try {
      await indexedDbMemoryPalaceRepository.save({
        id: idGenerator.generate('mps'),
        projectId,
        entityId: res.entityId,
        entityName: res.entityName,
        category: res.category,
        aliases: res.aliases ?? [],
        firstAppearedChapterId: res.firstAppearedChapter?.id,
        lastAppearedChapterId: res.lastAppearedChapter?.id,
        totalOccurrences: res.totalOccurrences,
        occurrences: res.occurrences ?? [],
        updatedAt: clock.now(),
      })
      setSavedSuccessMsg(`已建立「${res.entityName}」记忆宫殿持久快照`)
      setStorageError(null)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            记忆宫殿与历史实体快速召回仪 (Memory Palace)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            按已保存正文检索人物名与别名，保留章节版本和原文位置；字面命中需要结合上下文阅读。
          </p>
        </div>
        {savedSuccessMsg && (
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {savedSuccessMsg}
          </span>
        )}
      </div>

      {storageError && (
        <p role="alert">
          {storageError}
          <button onClick={() => setLoadAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="快速搜索人物名、法宝、地名、称号或生僻伏笔..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {runtimeSearchStatus === 'failed' ? (
        <div
          role="alert"
          data-testid="memory-palace-runtime-search-status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
        >
          <span>Runtime 检索失败，当前显示本地索引结果。{runtimeSearchError}</span>
          <button
            type="button"
            onClick={() => setRuntimeSearchRetry((attempt) => attempt + 1)}
            className="rounded-md border border-current px-2 py-1 font-medium"
          >
            重试 Runtime 检索
          </button>
        </div>
      ) : (
        <div
          role="status"
          data-testid="memory-palace-runtime-search-status"
          className="text-xs text-slate-500 dark:text-slate-400"
        >
          {!runtimeSearchAvailable
            ? 'Runtime 未连接，当前显示本地索引结果。'
            : runtimeSearchStatus === 'loading'
              ? 'Runtime 检索中，当前显示本地索引结果。'
              : runtimeSearchStatus === 'ready' && runtimeSearchResults?.length === 0
                ? 'Runtime 检索完成，未找到相关实体。'
                : runtimeSearchStatus === 'ready'
                  ? 'Runtime 检索完成。'
                  : '正在确认 Runtime 检索状态。'}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在构建跨卷记忆倒排索引...</div>
      ) : searchResults.length === 0 ? (
        <div className="text-center py-12 text-slate-400">未找到相关实体的历史登场轨迹。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.map((r) => (
            <div
              key={r.entityId}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-500 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-white">
                      {r.entityName}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                      {r.category}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <History className="w-3 h-3" /> 词项命中 {r.totalOccurrences} 次 ·{' '}
                    {r.matchedChapterCount ?? 0} 章
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">首次登场：</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                      {r.firstAppearedChapter
                        ? `${r.firstAppearedChapter.order ? '第 ' + r.firstAppearedChapter.order + ' 章' : '章序未知'} · ${r.firstAppearedChapter.title}`
                        : '暂无正文提及'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">最近一次登场：</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                      {r.lastAppearedChapter
                        ? `${r.lastAppearedChapter.order ? '第 ' + r.lastAppearedChapter.order + ' 章' : '章序未知'} · ${r.lastAppearedChapter.title}`
                        : '暂无正文提及'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> 最新正文片段回顾：
                  </div>
                  {r.recentSnippets.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">正文中暂未出现该词或别名</div>
                  ) : (
                    r.recentSnippets.map((snip, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 leading-relaxed font-serif"
                      >
                        {snip}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleSaveSnapshot(r)}
                  className="px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded flex items-center gap-1 transition"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  沉淀至记忆库
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function isEntitySearchResults(value: unknown): value is EntitySearchResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.entityId === 'string' &&
        typeof item.entityName === 'string' &&
        typeof item.totalOccurrences === 'number' &&
        Array.isArray(item.recentSnippets),
    )
  )
}
