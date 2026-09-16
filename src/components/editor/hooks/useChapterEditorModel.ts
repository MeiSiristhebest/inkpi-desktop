<<<<<<< ours
import { useReducer, useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import type { ChapterStatus, VolumeRecord, ChapterRecord } from '../../../types'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { renderChapterHtmlDocument } from '../../../adapters/htmlChapterRenderer'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../../../ports/keyValueStore'
import { setGhostText as showGhostText } from '../../../extensions/ghost-text'
import {
  countWords,
  formatChineseParagraphs,
  formatByPreset,
  type TypographyPreset,
  fixPunctuation,
  applyFindReplace,
  exportChapter,
  htmlToPlain,
  fontStackFor,
} from '../../../domain/text'
import { buildSeedVolumes, buildSeedChapters } from '../../../domain/seed'
import { composeChapterTitle } from '../../../domain/chapter/chapterNaming'
import { blankChapterContent } from '../../../domain/chapter/blankContent'
import { useSettings, type AppSettings } from '../../../core/settings'
import { useChapterAutosave } from './useChapterAutosave'
import { applyContentMutation } from '../editorContentBridge'
import { draftJournal } from '../../../services/draftJournal'
import { chapterMutationService } from '../../../services/defaultChapterMutationService'

export interface GlobalSearchResult {
  chapterId: string
  title: string
  snippet: string
  count: number
}

interface ChapterContextMenu {
  x: number
  y: number
  chapter: ChapterRecord
}

export type CanvasWidth = 'narrow' | 'wide' | 'full'

export interface EditorModelState {
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  activeChapterId: string
  activeChapter: ChapterRecord | null
  expanded: Record<string, boolean>
  isSaved: boolean
  treeQuery: string
  sessionWordDelta: number
  ghostText: string
  showGlobalSearch: boolean
  globalQuery: string
  globalResults: GlobalSearchResult[]
  excludedNumberingIds: Set<string>
  findText: string
  replaceText: string
  matchPositions: { from: number; to: number }[]
  activeMatch: number
  isSidebarOpen: boolean
  showFindReplace: boolean
  canvasWidth: CanvasWidth
  showSensitiveModal: boolean
  showLockModal: boolean
  showHistoryModal: boolean
  showOveruseModal: boolean
  showSplitView: boolean
  showScratchpad: boolean
  showWordCountPanelModal: boolean
  showBackgroundModal: boolean
  showFontFormatModal: boolean
  chapterContextMenu: ChapterContextMenu | null
  renamingChapter: ChapterRecord | null
  renamingTitle: string
  deletingChapter: ChapterRecord | null
  copiedChapterId: string | null
  renamingVolume: VolumeRecord | null
  renamingVolumeTitle: string
  deletingVolume: VolumeRecord | null
  volumeContextMenu: { x: number; y: number; volume: VolumeRecord } | null
}

type Action = { type: 'PATCH'; patch: Partial<EditorModelState> }

function createInitialState(projectId: string): EditorModelState {
  // useReducer 初始化器要求同步，此处通过 KeyValueStore 同步接口读取初始值。
  // 后续所有写操作均经由注入的 kvStore 端口（见 UseChapterEditorModelArgs.kvStore）。
  let canvasWidth: CanvasWidth = 'narrow'
  const savedWidth = localStorageKeyValueStore.getSync('inkpi-editor-canvas-width')
  if (savedWidth === 'narrow' || savedWidth === 'wide' || savedWidth === 'full')
    canvasWidth = savedWidth

  let excludedNumberingIds = new Set<string>()
  const savedExcluded = localStorageKeyValueStore.getSync(`inkpi-excluded-nums-${projectId}`)
  if (savedExcluded) {
    try {
      excludedNumberingIds = new Set(JSON.parse(savedExcluded))
    } catch {
      /* ignore */
    }
  }
  return {
    volumes: [],
    chapters: [],
    activeChapterId: '',
    activeChapter: null,
    expanded: {},
    isSaved: true,
    treeQuery: '',
    sessionWordDelta: 0,
    ghostText: '',
    showGlobalSearch: false,
    globalQuery: '',
    globalResults: [],
    excludedNumberingIds,
    findText: '',
    replaceText: '',
    matchPositions: [],
    activeMatch: 0,
    isSidebarOpen: true,
    showFindReplace: false,
    canvasWidth,
    showSensitiveModal: false,
    showLockModal: false,
    showHistoryModal: false,
    showOveruseModal: false,
    showSplitView: false,
    showScratchpad: false,
    showWordCountPanelModal: false,
    showBackgroundModal: false,
    showFontFormatModal: false,
    chapterContextMenu: null,
    renamingChapter: null,
    renamingTitle: '',
    deletingChapter: null,
    copiedChapterId: null,
    renamingVolume: null,
    renamingVolumeTitle: '',
    deletingVolume: null,
    volumeContextMenu: null,
  }
}

function reducer(state: EditorModelState, action: Action): EditorModelState {
  switch (action.type) {
    case 'PATCH':
      return { ...state, ...action.patch }
    default:
      return state
  }
}

export interface UseChapterEditorModelArgs {
  projectId: string
  editorRef: MutableRefObject<any>
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
  onRequestGhost?: (chapterId: string, text: string) => Promise<string | null>
  /** 轻量 KV 持久化端口（canvas-width / excluded-numbering-ids / chapter-history / scratchpad）。
   *  测试时注入内存实现；生产默认使用 localStorageKeyValueStore。
   */
  kvStore?: KeyValueStore
}

export interface ChapterEditorModel {
  // ── 状态（视图直接消费） ──
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  activeChapterId: string
  activeChapter: ChapterRecord | null
  expanded: Record<string, boolean>
  isSaved: boolean
  treeQuery: string
  sessionWordDelta: number
  ghostText: string
  showGlobalSearch: boolean
  globalQuery: string
  globalResults: GlobalSearchResult[]
  excludedNumberingIds: Set<string>
  findText: string
  replaceText: string
  matchPositions: { from: number; to: number }[]
  activeMatch: number
  isSidebarOpen: boolean
  showFindReplace: boolean
  canvasWidth: CanvasWidth
  showSensitiveModal: boolean
  showLockModal: boolean
  showHistoryModal: boolean
  showOveruseModal: boolean
  showSplitView: boolean
  showScratchpad: boolean
  showWordCountPanelModal: boolean
  showBackgroundModal: boolean
  showFontFormatModal: boolean
  chapterContextMenu: ChapterContextMenu | null
  renamingChapter: ChapterRecord | null
  renamingTitle: string
  deletingChapter: ChapterRecord | null
  copiedChapterId: string | null
  renamingVolume: VolumeRecord | null
  renamingVolumeTitle: string
  deletingVolume: VolumeRecord | null
  volumeContextMenu: { x: number; y: number; volume: VolumeRecord } | null
  // ── 派生数据 ──
  linearChapters: ChapterRecord[]
  currentChapterIndex: number
  filteredVolumes: { vol: VolumeRecord; chs: ChapterRecord[]; total: number }[]
  chapterNumberMap: Map<string, string>
  breadcrumb: string
  totalWords: number
  chapterWords: number
  fontStack: string
  fontSize: number
  lineHeight: number | string
  fontFamily: string
  paragraphSpacing?: number
  wordTarget: number
  showStatsBar: boolean
  defaultTypewriter: boolean
  // ── 命令（视图只负责派发） ──
  ghostTextRef: MutableRefObject<string>
  actions: ChapterEditorActions
  updateSettings?: (patch: Partial<AppSettings>) => void
}

export interface ChapterEditorActions {
  selectChapter: (ch: ChapterRecord) => void
  prevChapter: () => void
  nextChapter: () => void
  toggleVolume: (id: string) => void
  newChapter: (targetVolumeId?: string) => Promise<void>
  newVolume: () => Promise<void>
  renameChapter: (chapter: ChapterRecord, newTitle: string) => Promise<void>
  deleteChapter: (chapter: ChapterRecord) => Promise<void>
  renameVolume: (volume: VolumeRecord, newTitle: string) => Promise<void>
  deleteVolume: (volume: VolumeRecord) => Promise<void>
  moveChapterToVolume: (chapter: ChapterRecord, targetVolumeId: string) => Promise<void>
  duplicateChapter: (source: ChapterRecord) => Promise<void>
  copyChapterText: (chapter: ChapterRecord) => Promise<void>
  exportSingleChapter: (chapter: ChapterRecord, format: 'txt' | 'md') => void
  exportChapter: (format: 'txt' | 'md' | 'html') => void
  setStatus: (status: ChapterStatus) => Promise<void>
  setCanvasWidth: (next: CanvasWidth) => void
  toggleExcludeNumbering: (id: string) => void
  autoFormat: () => void
  formatWithPreset: (preset: TypographyPreset) => void
  punctuationFix: () => void
  executeReplace: () => void
  acceptGhostText: () => void
  runGlobalSearch: () => Promise<void>
  jumpToChapterFromSearch: (r: GlobalSearchResult) => void
  updateActiveTitle: (title: string) => void
  handleEditorUpdate: () => void
  save: () => void
  setGhostText: (v: string) => void
  setSidebar: (v: boolean) => void
  setShowFindReplace: (v: boolean) => void
  setShowSensitiveModal: (v: boolean) => void
  setShowLockModal: (v: boolean) => void
  setShowHistoryModal: (v: boolean) => void
  setShowOveruseModal: (v: boolean) => void
  setShowSplitView: (v: boolean) => void
  setShowScratchpad: (v: boolean) => void
  setShowWordCountPanelModal: (v: boolean) => void
  setShowBackgroundModal: (v: boolean) => void
  setShowFontFormatModal: (v: boolean) => void
  setShowGlobalSearch: (v: boolean) => void
  setChapterContextMenu: (v: ChapterContextMenu | null) => void
  setRenamingChapter: (v: ChapterRecord | null) => void
  setRenamingTitle: (v: string) => void
  setDeletingChapter: (v: ChapterRecord | null) => void
  setCopiedChapterId: (v: string | null) => void
  setRenamingVolume: (v: VolumeRecord | null) => void
  setRenamingVolumeTitle: (v: string) => void
  setDeletingVolume: (v: VolumeRecord | null) => void
  setVolumeContextMenu: (v: { x: number; y: number; volume: VolumeRecord } | null) => void
  setTreeQuery: (v: string) => void
  setGlobalQuery: (v: string) => void
  setFindText: (v: string) => void
  setReplaceText: (v: string) => void
  setActiveMatch: (v: number) => void
  refreshData: () => Promise<void>
}

/**
 * 章节编辑器核心模型（被动视图的数据与命令层）：
 *   - 单一 useReducer 收敛原 RichEditor 的全部 32 个 useState；
 *   - 所有持久化/副作用（IndexedDB、剪贴板、localStorage、Ghost 续写）走适配器或端口；
 *   - 视图层（RichEditor）只消费 state + 派发 actions，不再持有业务状态。
 */
export function useChapterEditorModel(args: UseChapterEditorModelArgs): ChapterEditorModel {
  const {
    projectId,
    editorRef,
    onStats,
    onRequestGhost,
    kvStore = localStorageKeyValueStore,
  } = args

  const [settings, updateSettings] = useSettings()
  const {
    fontSize,
    lineHeight,
    fontFamily,
    paragraphSpacing = 0.25,
    wordTarget,
    defaultTypewriter,
    showStatsBar,
  } = settings

  const [state, dispatch] = useReducer(reducer, projectId, createInitialState)
  const patch = useCallback(
    (p: Partial<EditorModelState>) => dispatch({ type: 'PATCH', patch: p }),
    [],
  )

  // 供回调读取的最新状态（避免 useCallback 闭包过期）
  const stateRef = useRef(state)
  stateRef.current = state
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const activeChapterRef = useRef<ChapterRecord | null>(null)
  const onRequestGhostRef = useRef(onRequestGhost)
  onRequestGhostRef.current = onRequestGhost
  const ghostTextRef = useRef('')
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const kvStoreRef = useRef(kvStore)
  kvStoreRef.current = kvStore

  const saveSnapshot = (ch: ChapterRecord) => {
    const key = `chapter-history-${ch.id}`
    void kvStoreRef.current.get(key).then((raw) => {
      try {
        const existing = JSON.parse(raw || '[]')
        const snapshot = {
          timestamp: clock.now(),
          wordCount: ch.wordCount,
          content: ch.content,
        }
        const updated = [snapshot, ...existing.slice(0, 19)]
        void kvStoreRef.current.set(key, JSON.stringify(updated))
      } catch {
        /* ignore */
      }
    })
  }

  const reportSaveError = useCallback(
    (error: unknown) => {
      console.warn('[InkPi Desktop] Chapter save failed:', error)
      patch({ isSaved: false })
    },
    [patch],
  )

  const flushSave = useCallback(
    async (ch?: ChapterRecord) => {
      const target = ch ?? activeChapterRef.current
      if (!target) return

      // P0: 用户输入存盘统一走 ChapterMutationService (INV-02)
      // 使用权威的 durable revision 模型，不绑定已陈旧的 target.revision，
      // 允许 mutation 依据最新真实 durable 版本推进存盘，杜绝 fast-typing 导致的伪 CAS 冲突
      const currentStoredRevision = activeChapterRef.current?.id === target.id
        ? activeChapterRef.current?.revision
        : target.revision

      const result = await chapterMutationService.mutate({
        workspaceId: projectId,
        chapterId: target.id,
        expectedRevision: currentStoredRevision,
        mutation: { type: 'replace-content', content: target.content || '' },
        origin: 'user-typing',
        countAsAuthorWriting: true,
      })

      if (!result.success) {
        throw new Error(result.error || 'Chapter mutation save failed')
      }

      const updated = result.chapter
      saveSnapshot(updated)
      if (activeChapterRef.current?.id === updated.id) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
        onStats?.({
          title: updated.title,
          wordCount: updated.wordCount,
          updatedAt: updated.updatedAt,
        })
      } else {
        patch({
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
        })
      }
    },
    [onStats, patch, projectId],
  )

  const runPersistence = useCallback(
    async (operation: () => Promise<void>): Promise<boolean> => {
      try {
        await operation()
        return true
      } catch (error) {
        reportSaveError(error)
        return false
      }
    },
    [reportSaveError],
  )

  const autosave = useChapterAutosave(flushSave, reportSaveError)

  const loadData = useCallback(async () => {
    const [allVols, allChs] = await Promise.all([
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])
    const projVols = allVols.sort((a, b) => a.order - b.order)
    const projChs = allChs.sort((a, b) => a.order - b.order)

    // 首次启动：写入种子卷章（仅当该项目无任何数据）
    if (projVols.length === 0 && projChs.length === 0) {
      const now = clock.now()
      const seedVols = buildSeedVolumes(projectId, idGenerator, clock).map((v) => ({
        ...v,
        createdAt: now,
        updatedAt: now,
      }))
      const firstVolumeId = seedVols[0]?.id
      const seedChs = buildSeedChapters(projectId, firstVolumeId, idGenerator, clock).map((c) => ({
        ...c,
        createdAt: now,
        updatedAt: now,
      }))
      for (const v of seedVols) {
        if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(v)))) return
      }
      for (const c of seedChs) {
        if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(c)))) return
      }
      const init: Record<string, boolean> = {}
      seedVols.forEach((v) => (init[v.id] = true))
      patch({
        volumes: seedVols,
        chapters: seedChs,
        expanded: init,
        activeChapterId: seedChs[0]?.id ?? '',
        activeChapter: seedChs[0] ?? null,
      })
      return
    }

    const init: Record<string, boolean> = {}
    projVols.forEach((v) => (init[v.id] = true))

    // P0.3 & P1.3: 优先恢复上次阅读/写作的章节，并检测是否存在未经存盘的草稿日记 (Draft WAL Crash Recovery)
    const lastChapterKey = `inkpi_last_active_chapter:${projectId}`
    let initialChapter = projChs[0] ?? null
    const savedChapterId = await kvStoreRef.current.get(lastChapterKey)
    if (savedChapterId) {
      const found = projChs.find((c) => c.id === savedChapterId)
      if (found) initialChapter = found
    }

    if (initialChapter) {
      const draft = draftJournal.get(projectId, initialChapter.id)
      const currentRev = initialChapter.revision ?? 1
      // P1: WAL 严格恢复条件 (baseRevision === currentRev 自动恢复；< 为过时冲突；> 为异常)
      if (
        draft &&
        draft.baseRevision === currentRev &&
        draft.updatedAt > (initialChapter.updatedAt || 0) &&
        draft.editorContent
      ) {
        initialChapter = {
          ...initialChapter,
          content: draft.editorContent,
          wordCount: countWords(draft.editorContent),
          updatedAt: draft.updatedAt,
        }
      }
    }

    patch({
      volumes: projVols,
      chapters: projChs,
      expanded: init,
      activeChapterId: initialChapter?.id ?? '',
      activeChapter: initialChapter,
    })
  }, [projectId, patch, runPersistence])

  useEffect(() => {
    void loadData().catch(reportSaveError)

    const handleBeforeUnload = () => {
      // 窗口关闭或刷新时执行强制落盘，杜绝丢稿 (INV-01)
      if (autosave.hasPending()) {
        void autosave.drain().catch(() => {})
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Tauri 原生窗口关闭拦截：防止用户直接点击原生 X 导致未落盘数据丢失
    let unlistenTauriClose: (() => void) | undefined
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          const appWindow = getCurrentWindow()
          return appWindow.onCloseRequested(async (event) => {
            if (autosave.hasPending()) {
              event.preventDefault()
              try {
                await autosave.drain()
                await appWindow.destroy()
              } catch (err) {
                reportSaveError(err)
              }
            }
          })
        })
        .then((unlisten) => {
          unlistenTauriClose = unlisten
        })
        .catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (unlistenTauriClose) {
        unlistenTauriClose()
      }
      // 组件卸载时强制原子 flush 而非仅仅 cancel
      if (autosave.hasPending()) {
        void autosave.flush().catch(() => {})
      }
      autosave.cancel()
      if (ghostTimer.current) clearTimeout(ghostTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const activateChapter = useCallback(
    async (nextChapter: ChapterRecord | null): Promise<boolean> => {
      // 切换章节前强制等待当前正在防抖/暂存的草稿全部 durable 落盘，杜绝切章竞态丢稿 (INV-01)
      if (autosave.hasPending()) {
        try {
          await autosave.drain()
        } catch (err) {
          reportSaveError(err)
          return false
        }
      }
      if (nextChapter) {
        void kvStoreRef.current.set(`inkpi_last_active_chapter:${projectId}`, nextChapter.id)
      }
      activeChapterRef.current = nextChapter
      patch({
        activeChapterId: nextChapter?.id ?? '',
        activeChapter: nextChapter,
        isSaved: true,
      })
      return true
    },
    [patch, autosave, reportSaveError, projectId],
  )

  const selectChapter = useCallback(
    (ch: ChapterRecord) => {
      void activateChapter(ch)
    },
    [activateChapter],
  )

  const toggleVolume = useCallback(
    (id: string) => {
      const prev = stateRef.current.expanded
      patch({ expanded: { ...prev, [id]: !prev[id] } })
    },
    [patch],
  )

  const handleNewVolume = useCallback(async () => {
    const { volumes } = stateRef.current
    const order = volumes.length
    const title = `第${order + 1}卷`
    const vol: VolumeRecord = {
      id: idGenerator.generate('vol'),
      projectId,
      title,
      order,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    }
    if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(vol)))) return
    patch({
      volumes: [...volumes, vol],
      expanded: { ...stateRef.current.expanded, [vol.id]: true },
    })
  }, [projectId, patch, runPersistence])

  const handleNewChapter = useCallback(
    async (targetVolumeId?: string) => {
      const { volumes, chapters, activeChapter } = stateRef.current
      let volId =
        targetVolumeId ||
        activeChapter?.volumeId ||
        (volumes.length > 0 ? volumes[volumes.length - 1].id : undefined)
      if (!volId) {
        const vol: VolumeRecord = {
          id: idGenerator.generate('vol'),
          projectId,
          title: '第一卷',
          order: 0,
          createdAt: clock.now(),
          updatedAt: clock.now(),
        }
        if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(vol)))) return
        patch({
          volumes: [...volumes, vol],
          expanded: { ...stateRef.current.expanded, [vol.id]: true },
        })
        volId = vol.id
      }
      const order = chapters.filter((c) => c.volumeId === volId).length
      const ch: ChapterRecord = {
        id: idGenerator.generate('ch'),
        projectId,
        volumeId: volId,
        title: composeChapterTitle(order),
        content: blankChapterContent(),
        wordCount: 0,
        order,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(ch)))) return
      patch({
        chapters: [...stateRef.current.chapters, ch],
        expanded: { ...stateRef.current.expanded, [volId]: true },
      })
      await activateChapter(ch)
    },
    [projectId, patch, runPersistence, activateChapter],
  )

  const renameChapter = useCallback(
    async (chapter: ChapterRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === chapter.title) {
        patch({ renamingChapter: null })
        return
      }
      const updated = { ...chapter, title: trimmed, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      const next: Partial<EditorModelState> = { chapters, renamingChapter: null }
      if (stateRef.current.activeChapterId === updated.id) {
        next.activeChapter = updated
        onStats?.({
          title: updated.title,
          wordCount: updated.wordCount,
          updatedAt: updated.updatedAt,
        })
      }
      patch(next)
    },
    [onStats, patch, runPersistence],
  )

  const deleteChapter = useCallback(
    async (chapter: ChapterRecord) => {
      if (!(await runPersistence(() => indexedDbProjectRepository.deleteChapter(chapter.id))))
        return
      const nextList = stateRef.current.chapters.filter((c) => c.id !== chapter.id)
      patch({ chapters: nextList, deletingChapter: null })
      if (stateRef.current.activeChapterId === chapter.id) {
        await activateChapter(nextList.length > 0 ? nextList[0] : null)
      }
    },
    [patch, runPersistence, activateChapter],
  )

  const renameVolume = useCallback(
    async (volume: VolumeRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === volume.title) {
        patch({ renamingVolume: null })
        return
      }
      const updated = { ...volume, title: trimmed, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(updated)))) return
      const volumes = stateRef.current.volumes.map((v) => (v.id === updated.id ? updated : v))
      patch({ volumes, renamingVolume: null })
    },
    [patch, runPersistence],
  )

  const deleteVolume = useCallback(
    async (volume: VolumeRecord) => {
      if (!(await runPersistence(() => indexedDbProjectRepository.deleteVolume(volume.id)))) return
      const volumes = stateRef.current.volumes.filter((v) => v.id !== volume.id)
      const fallbackVolId = volumes[0]?.id
      let chapters = stateRef.current.chapters
      let persistenceFailed = false
      if (fallbackVolId) {
        chapters = await Promise.all(
          chapters.map(async (ch) => {
            if (ch.volumeId === volume.id) {
              const updated = { ...ch, volumeId: fallbackVolId, updatedAt: clock.now() }
              if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) {
                persistenceFailed = true
                return ch
              }
              return updated
            }
            return ch
          }),
        )
        if (persistenceFailed) return
      } else {
        // 无其余分卷时，删除该卷下所有章节
        for (const ch of chapters.filter((c) => c.volumeId === volume.id)) {
          if (!(await runPersistence(() => indexedDbProjectRepository.deleteChapter(ch.id)))) return
        }
        chapters = chapters.filter((c) => c.volumeId !== volume.id)
      }
      patch({ volumes, chapters, deletingVolume: null })
    },
    [patch, runPersistence],
  )

  const moveChapterToVolume = useCallback(
    async (chapter: ChapterRecord, targetVolumeId: string) => {
      if (chapter.volumeId === targetVolumeId) return
      const order = stateRef.current.chapters.filter((c) => c.volumeId === targetVolumeId).length
      const updated = { ...chapter, volumeId: targetVolumeId, order, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      const next: Partial<EditorModelState> = {
        chapters,
        expanded: { ...stateRef.current.expanded, [targetVolumeId]: true },
      }
      if (stateRef.current.activeChapterId === updated.id) {
        next.activeChapter = updated
      }
      patch(next)
    },
    [patch, runPersistence],
  )

  const duplicateChapter = useCallback(
    async (source: ChapterRecord) => {
      const order = stateRef.current.chapters.filter((c) => c.volumeId === source.volumeId).length
      const copyCh: ChapterRecord = {
        id: idGenerator.generate('ch'),
        projectId: source.projectId,
        volumeId: source.volumeId,
        title: `${source.title} (副本)`,
        content: source.content || blankChapterContent(),
        wordCount: source.wordCount || 0,
        order,
        status: 'draft',
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(copyCh)))) return
      patch({
        chapters: [...stateRef.current.chapters, copyCh],
      })
      await activateChapter(copyCh)
    },
    [patch, runPersistence, activateChapter],
  )

  const copyChapterText = useCallback(
    async (chapter: ChapterRecord) => {
      try {
        const plain = htmlToPlain(chapter.content || '')
        await clipboardWriter.writeText(`${chapter.title}\n\n${plain}`)
        patch({ copiedChapterId: chapter.id })
        setTimeout(() => patch({ copiedChapterId: null }), 2000)
      } catch {
        /* ignore */
      }
    },
    [patch],
  )

  const exportSingleChapter = useCallback((chapter: ChapterRecord, format: 'txt' | 'md') => {
    const plain = htmlToPlain(chapter.content || '')
    const content =
      format === 'md' ? `# ${chapter.title}\n\n${plain}` : `${chapter.title}\n\n${plain}`
    const blob = new Blob([content], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    })
    blobFileDownloader.downloadBlob(`${chapter.title}.${format}`, blob)
  }, [])

  const setStatus = useCallback(
    async (status: ChapterStatus) => {
      const cur = stateRef.current.activeChapter
      if (!cur) return
      const updated = { ...cur, status, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      patch({ chapters, activeChapter: updated })
      onStats?.({
        title: updated.title,
        wordCount: updated.wordCount,
        updatedAt: updated.updatedAt,
      })
    },
    [onStats, patch, runPersistence],
  )

  const setCanvasWidth = useCallback(
    (next: CanvasWidth) => {
      patch({ canvasWidth: next })
      void kvStoreRef.current.set('inkpi-editor-canvas-width', next)
    },
    [patch],
  )

  const toggleExcludeNumbering = useCallback(
    (chId: string) => {
      const next = new Set(stateRef.current.excludedNumberingIds)
      if (next.has(chId)) next.delete(chId)
      else next.add(chId)
      void kvStoreRef.current.set(
        `inkpi-excluded-nums-${projectId}`,
        JSON.stringify(Array.from(next)),
      )
      patch({ excludedNumberingIds: next })
    },
    [projectId, patch],
  )

  const autoFormat = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return
    const text = ed.getText()
    const { normalizePunctuationOnFormat: norm, paragraphIndent: indent } = settingsRef.current
    const formatted = norm ? fixPunctuation(text, indent) : formatChineseParagraphs(text, indent)
    void applyContentMutation(ed, formatted, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const formatWithPreset = useCallback(
    (preset: TypographyPreset) => {
      const ed = editorRef.current
      const cur = activeChapterRef.current
      if (!ed || ed.isDestroyed || !cur) return
      const formatted = formatByPreset(ed.getHTML() || ed.getText(), preset)
      void applyContentMutation(ed, formatted, {
        workspaceId: projectId,
        chapterId: cur.id,
        expectedRevision: cur.revision,
        origin: 'format',
      }).then((updated) => {
        if (updated) {
          activeChapterRef.current = updated
          patch({
            activeChapter: updated,
            chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
            isSaved: true,
          })
        }
      })
    },
    [editorRef, patch, projectId],
  )

  const punctuationFix = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return
    const fixed = fixPunctuation(ed.getText())
    void applyContentMutation(ed, fixed, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const executeReplace = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    const find = stateRef.current.findText
    if (!ed || ed.isDestroyed || !find || !cur) return
    const replaced = applyFindReplace(ed.getHTML(), find, stateRef.current.replaceText)
    void applyContentMutation(ed, replaced, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const setGhostText = useCallback(
    (v: string) => {
      ghostTextRef.current = v
      patch({ ghostText: v })
    },
    [patch],
  )

  const acceptGhostText = useCallback(() => {
    const ed = editorRef.current
    if (ed && !ed.isDestroyed && stateRef.current.ghostText) {
      ed.commands.insertContent(stateRef.current.ghostText)
      setGhostText('')
    }
  }, [editorRef, patch, setGhostText])

  const findMatchesInDoc = useCallback(
    (query: string): { from: number; to: number }[] => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed || !query) return []
      const doc = ed.state?.doc
      if (!doc || typeof doc.descendants !== 'function') return []
      const lower = query.toLowerCase()
      const results: { from: number; to: number }[] = []
      ed.state.doc.descendants((node: any, pos: number) => {
        if (!node.isText) return
        const t = node.text || ''
        let idx = t.toLowerCase().indexOf(lower)
        while (idx !== -1) {
          results.push({ from: pos + idx, to: pos + idx + query.length })
          idx = t.toLowerCase().indexOf(lower, idx + query.length)
        }
      })
      return results
    },
    [editorRef],
  )

  const runGlobalSearch = useCallback(async () => {
    const q = stateRef.current.globalQuery.trim()
    if (!q) {
      patch({ globalResults: [] })
      return
    }
    const proj = await indexedDbProjectRepository.getChaptersByProject(projectId)
    const res: GlobalSearchResult[] = []
    for (const ch of proj) {
      const plain = htmlToPlain(ch.content || '')
      const idx = plain.indexOf(q)
      if (idx === -1) continue
      const count = plain.split(q).length - 1
      const start = Math.max(0, idx - 24)
      const snippet = plain
        .substring(start, start + 64)
        .replace(/\s+/g, ' ')
        .trim()
      res.push({ chapterId: ch.id, title: ch.title, snippet, count })
    }
    res.sort((a, b) => b.count - a.count)
    patch({ globalResults: res })
  }, [projectId, patch])

  const jumpToChapterFromSearch = useCallback(
    (r: GlobalSearchResult) => {
      const ch = stateRef.current.chapters.find((c) => c.id === r.chapterId)
      if (ch) {
        patch({
          showGlobalSearch: false,
          findText: stateRef.current.globalQuery.trim(),
          showFindReplace: true,
        })
        void activateChapter(ch)
      } else {
        patch({ showGlobalSearch: false })
      }
    },
    [patch, activateChapter],
  )

  const updateActiveTitle = useCallback(
    (title: string) => {
      const cur = stateRef.current.activeChapter
      if (!cur) return
      const updated = { ...cur, title }
      patch({
        activeChapter: updated,
        chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
        isSaved: false,
      })
    },
    [patch],
  )

  const handleEditorUpdate = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return

    const html = ed.getHTML()
    const text = ed.getText()
    const wc = countWords(text)
    const diff = wc - cur.wordCount

    // P0-1: 键盘输入仅更新 transient 内容，不任意 revision++，保持与 durable revision 对齐
    const updated: ChapterRecord = {
      ...cur,
      content: html,
      wordCount: wc,
      revision: cur.revision ?? 1,
      updatedAt: clock.now(),
    }
    activeChapterRef.current = updated
    patch({
      activeChapter: updated,
      chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
      isSaved: false,
      sessionWordDelta: stateRef.current.sessionWordDelta + (diff > 0 ? diff : 0),
    })

    // 行内 Ghost Text 续写：防抖请求
    if (onRequestGhostRef.current && text.length > 5) {
      if (ghostTimer.current) clearTimeout(ghostTimer.current)
      const tail = text.slice(-200)
      const chId = cur.id
      ghostTimer.current = setTimeout(() => {
        onRequestGhostRef.current!(chId, tail)
          .then((suggestion) => {
            if (suggestion) {
              setGhostText(suggestion)
              showGhostText(ed, suggestion)
            }
          })
          .catch(() => {})
      }, 600)
    }

    // P0.3: 用户打字时写入轻量本地草稿日记 (Draft WAL)，防范系统闪退 (INV-01)
    draftJournal.record({
      workspaceId: projectId,
      chapterId: cur.id,
      baseRevision: cur.revision ?? 1,
      editorContent: html,
      updatedAt: clock.now(),
    })

    // 防抖自动存盘到 IndexedDB（受「自动保存」设置控制）
    if (settingsRef.current.autoSave) {
      autosave.schedule(updated, settingsRef.current.autoSaveDelay)
    }
  }, [editorRef, patch, setGhostText, autosave])

  const save = useCallback(() => {
    void flushSave().catch(reportSaveError)
  }, [flushSave, reportSaveError])

  // ── 切换章节时把内容灌入编辑器（不覆盖正在进行的输入）──
  useEffect(() => {
    activeChapterRef.current = state.activeChapter
  }, [state.activeChapter])

  // 全文检索（文档内）：检索词变化时，重算匹配并跳到首个
  useEffect(() => {
    const ed = editorRef.current
    const find = state.findText
    if (!ed || ed.isDestroyed) return
    if (!find) {
      patch({ matchPositions: [], activeMatch: 0 })
      return
    }
    const res = findMatchesInDoc(find)
    patch({ matchPositions: res, activeMatch: 0 })
    if (res.length > 0) {
      ed.commands.setTextSelection({ from: res[0].from, to: res[0].to })
      ed.commands.scrollIntoView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.findText])

  // 上报统计给外层引擎（右侧信息栏）
  useEffect(() => {
    onStats?.({
      title: state.activeChapter?.title,
      wordCount: state.activeChapter?.wordCount ?? 0,
      updatedAt: state.activeChapter?.updatedAt,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeChapter])

  /* ── 派生数据 ──────────────────────────────────────────── */
  const linearChapters = state.volumes.flatMap((v) =>
    state.chapters.filter((c) => c.volumeId === v.id).sort((a, b) => a.order - b.order),
  )
  const currentChapterIndex = linearChapters.findIndex((c) => c.id === state.activeChapterId)

  const treeQueryTrimmed = state.treeQuery.trim().toLowerCase()
  const filteredVolumes = state.volumes
    .map((vol) => {
      const volChs = state.chapters
        .filter((c) => c.volumeId === vol.id)
        .sort((a, b) => a.order - b.order)
      const matchedChs = treeQueryTrimmed
        ? volChs.filter((c) => c.title.toLowerCase().includes(treeQueryTrimmed))
        : volChs
      return { vol, chs: matchedChs, total: volChs.length }
    })
    .filter(
      ({ vol, chs, total }) =>
        !treeQueryTrimmed ||
        chs.length > 0 ||
        (vol.title.toLowerCase().includes(treeQueryTrimmed) && total > 0),
    )

  const chapterNumberMap = (() => {
    const map = new Map<string, string>()
    let currentNum = 1
    // 若标题中已包含显式序数词（如 "第001章", "第1章", "01 ", "Chapter 1"），则无需再机械式前置数字
    const hasExplicitNumbering =
      /^(第\s*[\d一二三四五六七八九十百千]+\s*[章节回节篇卷]|chapter\s*\d+|\d{1,4}[.\s、_-])/i
    for (const ch of linearChapters) {
      if (state.excludedNumberingIds.has(ch.id) || hasExplicitNumbering.test(ch.title.trim())) {
        map.set(ch.id, '')
      } else {
        map.set(ch.id, String(currentNum))
        currentNum++
      }
    }
    return map
  })()

  const breadcrumb = (() => {
    const ac = state.activeChapter
    if (!ac) return ''
    const volIdx = state.volumes.findIndex((v) => v.id === ac.volumeId)
    if (volIdx < 0) return ''
    const volChs = state.chapters
      .filter((c) => c.volumeId === ac.volumeId)
      .sort((a, b) => a.order - b.order)
    const chIdx = volChs.findIndex((c) => c.id === ac.id)
    if (chIdx < 0) return ''
    return `第${volIdx + 1}卷 · 第${chIdx + 1}章`
  })()

  const totalWords = state.chapters.reduce((acc, c) => acc + c.wordCount, 0)
  const chapterWords = state.activeChapter?.wordCount || 0
  const fontStack = fontStackFor(fontFamily)

  const prevChapter = useCallback(() => {
    if (currentChapterIndex > 0) selectChapter(linearChapters[currentChapterIndex - 1])
  }, [currentChapterIndex, linearChapters, selectChapter])

  const nextChapter = useCallback(() => {
    if (currentChapterIndex >= 0 && currentChapterIndex < linearChapters.length - 1) {
      selectChapter(linearChapters[currentChapterIndex + 1])
    }
  }, [currentChapterIndex, linearChapters, selectChapter])

  const actions: ChapterEditorActions = {
    selectChapter,
    prevChapter,
    nextChapter,
    toggleVolume,
    newChapter: handleNewChapter,
    newVolume: handleNewVolume,
    renameChapter,
    deleteChapter,
    renameVolume,
    deleteVolume,
    moveChapterToVolume,
    duplicateChapter,
    copyChapterText,
    exportSingleChapter,
    exportChapter: (format: 'txt' | 'md' | 'html') => {
      const ed = editorRef.current
      const ac = stateRef.current.activeChapter
      if (!ac || !ed || ed.isDestroyed) return
      const output =
        format === 'html'
          ? renderChapterHtmlDocument(ac.title, ed.getHTML())
          : exportChapter(ed.getHTML(), format, ac.title)
      const blob = new Blob([output], {
        type: format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8',
      })
      blobFileDownloader.downloadBlob(`${ac.title}.${format}`, blob)
    },
    setStatus,
    setCanvasWidth,
    toggleExcludeNumbering,
    autoFormat,
    formatWithPreset,
    punctuationFix,
    executeReplace,
    acceptGhostText,
    runGlobalSearch,
    jumpToChapterFromSearch,
    updateActiveTitle,
    handleEditorUpdate,
    save,
    setGhostText,
    setSidebar: (v: boolean) => patch({ isSidebarOpen: v }),
    setShowFindReplace: (v: boolean) => patch({ showFindReplace: v }),
    setShowSensitiveModal: (v: boolean) => patch({ showSensitiveModal: v }),
    setShowLockModal: (v: boolean) => patch({ showLockModal: v }),
    setShowHistoryModal: (v: boolean) => patch({ showHistoryModal: v }),
    setShowOveruseModal: (v: boolean) => patch({ showOveruseModal: v }),
    setShowSplitView: (v: boolean) => patch({ showSplitView: v }),
    setShowScratchpad: (v: boolean) => patch({ showScratchpad: v }),
    setShowWordCountPanelModal: (v: boolean) => patch({ showWordCountPanelModal: v }),
    setShowBackgroundModal: (v: boolean) => patch({ showBackgroundModal: v }),
    setShowFontFormatModal: (v: boolean) => patch({ showFontFormatModal: v }),
    setShowGlobalSearch: (v: boolean) => patch({ showGlobalSearch: v }),
    setChapterContextMenu: (v) => patch({ chapterContextMenu: v }),
    setRenamingChapter: (v) => patch({ renamingChapter: v }),
    setRenamingTitle: (v) => patch({ renamingTitle: v }),
    setDeletingChapter: (v) => patch({ deletingChapter: v }),
    setCopiedChapterId: (v) => patch({ copiedChapterId: v }),
    setRenamingVolume: (v) => patch({ renamingVolume: v }),
    setRenamingVolumeTitle: (v) => patch({ renamingVolumeTitle: v }),
    setDeletingVolume: (v) => patch({ deletingVolume: v }),
    setVolumeContextMenu: (v) => patch({ volumeContextMenu: v }),
    setTreeQuery: (v) => patch({ treeQuery: v }),
    setGlobalQuery: (v) => patch({ globalQuery: v }),
    setFindText: (v) => patch({ findText: v }),
    setReplaceText: (v) => patch({ replaceText: v }),
    setActiveMatch: (v) => patch({ activeMatch: v }),
    refreshData: loadData,
  }

  return {
    ...state,
    linearChapters,
    currentChapterIndex,
    filteredVolumes,
    chapterNumberMap,
    breadcrumb,
    totalWords,
    chapterWords,
    fontStack,
    fontSize,
    lineHeight,
    fontFamily,
    paragraphSpacing,
    wordTarget,
    showStatsBar,
    defaultTypewriter,
    ghostTextRef,
    actions,
    updateSettings,
  }
}

/** 编辑器模型类型：状态 + 派生值 + actions + ghostTextRef，供 organisms 以 props 接收 */
export type EditorModel = ReturnType<typeof useChapterEditorModel>
=======
import { useReducer, useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import type { ChapterStatus, VolumeRecord, ChapterRecord } from '../../../types'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { renderChapterHtmlDocument } from '../../../adapters/htmlChapterRenderer'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../../../ports/keyValueStore'
import { setGhostText as showGhostText } from '../../../extensions/ghost-text'
import {
  countWords,
  formatChineseParagraphs,
  formatByPreset,
  type TypographyPreset,
  fixPunctuation,
  applyFindReplace,
  exportChapter,
  htmlToPlain,
  fontStackFor,
} from '../../../domain/text'
import { buildSeedVolumes, buildSeedChapters } from '../../../domain/seed'
import { composeChapterTitle } from '../../../domain/chapter/chapterNaming'
import { blankChapterContent } from '../../../domain/chapter/blankContent'
import { useSettings, type AppSettings } from '../../../core/settings'
import { useChapterAutosave } from './useChapterAutosave'
import { applyContentMutation } from '../editorContentBridge'
import { draftJournal } from '../../../services/draftJournal'
import { chapterMutationService } from '../../../services/defaultChapterMutationService'

export interface GlobalSearchResult {
  chapterId: string
  title: string
  snippet: string
  count: number
}

interface ChapterContextMenu {
  x: number
  y: number
  chapter: ChapterRecord
}

export type CanvasWidth = 'narrow' | 'wide' | 'full'

export interface EditorModelState {
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  activeChapterId: string
  activeChapter: ChapterRecord | null
  expanded: Record<string, boolean>
  isSaved: boolean
  treeQuery: string
  sessionWordDelta: number
  ghostText: string
  showGlobalSearch: boolean
  globalQuery: string
  globalResults: GlobalSearchResult[]
  excludedNumberingIds: Set<string>
  findText: string
  replaceText: string
  matchPositions: { from: number; to: number }[]
  activeMatch: number
  isSidebarOpen: boolean
  showFindReplace: boolean
  canvasWidth: CanvasWidth
  showSensitiveModal: boolean
  showLockModal: boolean
  showHistoryModal: boolean
  showOveruseModal: boolean
  showSplitView: boolean
  showScratchpad: boolean
  showWordCountPanelModal: boolean
  showBackgroundModal: boolean
  showFontFormatModal: boolean
  chapterContextMenu: ChapterContextMenu | null
  renamingChapter: ChapterRecord | null
  renamingTitle: string
  deletingChapter: ChapterRecord | null
  copiedChapterId: string | null
  renamingVolume: VolumeRecord | null
  renamingVolumeTitle: string
  deletingVolume: VolumeRecord | null
  volumeContextMenu: { x: number; y: number; volume: VolumeRecord } | null
}

type Action = { type: 'PATCH'; patch: Partial<EditorModelState> }

function createInitialState(projectId: string): EditorModelState {
  // useReducer 初始化器要求同步，此处通过 KeyValueStore 同步接口读取初始值。
  // 后续所有写操作均经由注入的 kvStore 端口（见 UseChapterEditorModelArgs.kvStore）。
  let canvasWidth: CanvasWidth = 'narrow'
  const savedWidth = localStorageKeyValueStore.getSync('inkpi-editor-canvas-width')
  if (savedWidth === 'narrow' || savedWidth === 'wide' || savedWidth === 'full')
    canvasWidth = savedWidth

  let excludedNumberingIds = new Set<string>()
  const savedExcluded = localStorageKeyValueStore.getSync(`inkpi-excluded-nums-${projectId}`)
  if (savedExcluded) {
    try {
      excludedNumberingIds = new Set(JSON.parse(savedExcluded))
    } catch {
      /* ignore */
    }
  }
  return {
    volumes: [],
    chapters: [],
    activeChapterId: '',
    activeChapter: null,
    expanded: {},
    isSaved: true,
    treeQuery: '',
    sessionWordDelta: 0,
    ghostText: '',
    showGlobalSearch: false,
    globalQuery: '',
    globalResults: [],
    excludedNumberingIds,
    findText: '',
    replaceText: '',
    matchPositions: [],
    activeMatch: 0,
    isSidebarOpen: true,
    showFindReplace: false,
    canvasWidth,
    showSensitiveModal: false,
    showLockModal: false,
    showHistoryModal: false,
    showOveruseModal: false,
    showSplitView: false,
    showScratchpad: false,
    showWordCountPanelModal: false,
    showBackgroundModal: false,
    showFontFormatModal: false,
    chapterContextMenu: null,
    renamingChapter: null,
    renamingTitle: '',
    deletingChapter: null,
    copiedChapterId: null,
    renamingVolume: null,
    renamingVolumeTitle: '',
    deletingVolume: null,
    volumeContextMenu: null,
  }
}

function reducer(state: EditorModelState, action: Action): EditorModelState {
  switch (action.type) {
    case 'PATCH':
      return { ...state, ...action.patch }
    default:
      return state
  }
}

export interface UseChapterEditorModelArgs {
  projectId: string
  editorRef: MutableRefObject<any>
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
  onRequestGhost?: (chapterId: string, text: string) => Promise<string | null>
  /** 轻量 KV 持久化端口（canvas-width / excluded-numbering-ids / chapter-history / scratchpad）。
   *  测试时注入内存实现；生产默认使用 localStorageKeyValueStore。
   */
  kvStore?: KeyValueStore
}

export interface ChapterEditorModel {
  // ── 状态（视图直接消费） ──
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  activeChapterId: string
  activeChapter: ChapterRecord | null
  expanded: Record<string, boolean>
  isSaved: boolean
  treeQuery: string
  sessionWordDelta: number
  ghostText: string
  showGlobalSearch: boolean
  globalQuery: string
  globalResults: GlobalSearchResult[]
  excludedNumberingIds: Set<string>
  findText: string
  replaceText: string
  matchPositions: { from: number; to: number }[]
  activeMatch: number
  isSidebarOpen: boolean
  showFindReplace: boolean
  canvasWidth: CanvasWidth
  showSensitiveModal: boolean
  showLockModal: boolean
  showHistoryModal: boolean
  showOveruseModal: boolean
  showSplitView: boolean
  showScratchpad: boolean
  showWordCountPanelModal: boolean
  showBackgroundModal: boolean
  showFontFormatModal: boolean
  chapterContextMenu: ChapterContextMenu | null
  renamingChapter: ChapterRecord | null
  renamingTitle: string
  deletingChapter: ChapterRecord | null
  copiedChapterId: string | null
  renamingVolume: VolumeRecord | null
  renamingVolumeTitle: string
  deletingVolume: VolumeRecord | null
  volumeContextMenu: { x: number; y: number; volume: VolumeRecord } | null
  // ── 派生数据 ──
  linearChapters: ChapterRecord[]
  currentChapterIndex: number
  filteredVolumes: { vol: VolumeRecord; chs: ChapterRecord[]; total: number }[]
  chapterNumberMap: Map<string, string>
  breadcrumb: string
  totalWords: number
  chapterWords: number
  fontStack: string
  fontSize: number
  lineHeight: number | string
  fontFamily: string
  paragraphSpacing?: number
  wordTarget: number
  showStatsBar: boolean
  defaultTypewriter: boolean
  // ── 命令（视图只负责派发） ──
  ghostTextRef: MutableRefObject<string>
  actions: ChapterEditorActions
  updateSettings?: (patch: Partial<AppSettings>) => void
}

export interface ChapterEditorActions {
  selectChapter: (ch: ChapterRecord) => void
  prevChapter: () => void
  nextChapter: () => void
  toggleVolume: (id: string) => void
  newChapter: (targetVolumeId?: string) => Promise<void>
  newVolume: () => Promise<void>
  renameChapter: (chapter: ChapterRecord, newTitle: string) => Promise<void>
  deleteChapter: (chapter: ChapterRecord) => Promise<void>
  renameVolume: (volume: VolumeRecord, newTitle: string) => Promise<void>
  deleteVolume: (volume: VolumeRecord) => Promise<void>
  moveChapterToVolume: (chapter: ChapterRecord, targetVolumeId: string) => Promise<void>
  duplicateChapter: (source: ChapterRecord) => Promise<void>
  copyChapterText: (chapter: ChapterRecord) => Promise<void>
  exportSingleChapter: (chapter: ChapterRecord, format: 'txt' | 'md') => void
  exportChapter: (format: 'txt' | 'md' | 'html') => void
  setStatus: (status: ChapterStatus) => Promise<void>
  setCanvasWidth: (next: CanvasWidth) => void
  toggleExcludeNumbering: (id: string) => void
  autoFormat: () => void
  formatWithPreset: (preset: TypographyPreset) => void
  punctuationFix: () => void
  executeReplace: () => void
  acceptGhostText: () => void
  runGlobalSearch: () => Promise<void>
  jumpToChapterFromSearch: (r: GlobalSearchResult) => void
  updateActiveTitle: (title: string) => void
  handleEditorUpdate: () => void
  save: () => void
  setGhostText: (v: string) => void
  setSidebar: (v: boolean) => void
  setShowFindReplace: (v: boolean) => void
  setShowSensitiveModal: (v: boolean) => void
  setShowLockModal: (v: boolean) => void
  setShowHistoryModal: (v: boolean) => void
  setShowOveruseModal: (v: boolean) => void
  setShowSplitView: (v: boolean) => void
  setShowScratchpad: (v: boolean) => void
  setShowWordCountPanelModal: (v: boolean) => void
  setShowBackgroundModal: (v: boolean) => void
  setShowFontFormatModal: (v: boolean) => void
  setShowGlobalSearch: (v: boolean) => void
  setChapterContextMenu: (v: ChapterContextMenu | null) => void
  setRenamingChapter: (v: ChapterRecord | null) => void
  setRenamingTitle: (v: string) => void
  setDeletingChapter: (v: ChapterRecord | null) => void
  setCopiedChapterId: (v: string | null) => void
  setRenamingVolume: (v: VolumeRecord | null) => void
  setRenamingVolumeTitle: (v: string) => void
  setDeletingVolume: (v: VolumeRecord | null) => void
  setVolumeContextMenu: (v: { x: number; y: number; volume: VolumeRecord } | null) => void
  setTreeQuery: (v: string) => void
  setGlobalQuery: (v: string) => void
  setFindText: (v: string) => void
  setReplaceText: (v: string) => void
  setActiveMatch: (v: number) => void
  refreshData: () => Promise<void>
}

/**
 * 章节编辑器核心模型（被动视图的数据与命令层）：
 *   - 单一 useReducer 收敛原 RichEditor 的全部 32 个 useState；
 *   - 所有持久化/副作用（IndexedDB、剪贴板、localStorage、Ghost 续写）走适配器或端口；
 *   - 视图层（RichEditor）只消费 state + 派发 actions，不再持有业务状态。
 */
export function useChapterEditorModel(args: UseChapterEditorModelArgs): ChapterEditorModel {
  const {
    projectId,
    editorRef,
    onStats,
    onRequestGhost,
    kvStore = localStorageKeyValueStore,
  } = args

  const [settings, updateSettings] = useSettings()
  const {
    fontSize,
    lineHeight,
    fontFamily,
    paragraphSpacing = 0.25,
    wordTarget,
    defaultTypewriter,
    showStatsBar,
  } = settings

  const [state, dispatch] = useReducer(reducer, projectId, createInitialState)
  const patch = useCallback(
    (p: Partial<EditorModelState>) => dispatch({ type: 'PATCH', patch: p }),
    [],
  )

  // 供回调读取的最新状态（避免 useCallback 闭包过期）
  const stateRef = useRef(state)
  stateRef.current = state
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const activeChapterRef = useRef<ChapterRecord | null>(null)
  const onRequestGhostRef = useRef(onRequestGhost)
  onRequestGhostRef.current = onRequestGhost
  const ghostTextRef = useRef('')
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const kvStoreRef = useRef(kvStore)
  kvStoreRef.current = kvStore

  const saveSnapshot = (ch: ChapterRecord) => {
    const key = `chapter-history-${ch.id}`
    void kvStoreRef.current.get(key).then((raw) => {
      try {
        const existing = JSON.parse(raw || '[]')
        const snapshot = {
          timestamp: clock.now(),
          wordCount: ch.wordCount,
          content: ch.content,
        }
        const updated = [snapshot, ...existing.slice(0, 19)]
        void kvStoreRef.current.set(key, JSON.stringify(updated))
      } catch {
        /* ignore */
      }
    })
  }

  const reportSaveError = useCallback(
    (error: unknown) => {
      console.warn('[InkPi Desktop] Chapter save failed:', error)
      patch({ isSaved: false })
    },
    [patch],
  )

  const flushSave = useCallback(
    async (ch?: ChapterRecord) => {
      const target = ch ?? activeChapterRef.current
      if (!target) return

      // P0: 用户输入存盘统一走 ChapterMutationService (INV-02)
      // 使用权威的 durable revision 模型，不绑定已陈旧的 target.revision，
      // 允许 mutation 依据最新真实 durable 版本推进存盘，杜绝 fast-typing 导致的伪 CAS 冲突
      const currentStoredRevision = activeChapterRef.current?.id === target.id
        ? activeChapterRef.current?.revision
        : target.revision

      const result = await chapterMutationService.mutate({
        workspaceId: projectId,
        chapterId: target.id,
        expectedRevision: currentStoredRevision,
        mutation: { type: 'replace-content', content: target.content || '' },
        origin: 'user-typing',
        countAsAuthorWriting: true,
      })

      if (!result.success) {
        throw new Error(result.error || 'Chapter mutation save failed')
      }

      const updated = result.chapter
      saveSnapshot(updated)
      if (activeChapterRef.current?.id === updated.id) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
        onStats?.({
          title: updated.title,
          wordCount: updated.wordCount,
          updatedAt: updated.updatedAt,
        })
      } else {
        patch({
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
        })
      }
    },
    [onStats, patch, projectId],
  )

  const runPersistence = useCallback(
    async (operation: () => Promise<void>): Promise<boolean> => {
      try {
        await operation()
        return true
      } catch (error) {
        reportSaveError(error)
        return false
      }
    },
    [reportSaveError],
  )

  const autosave = useChapterAutosave(flushSave, reportSaveError)

  const loadData = useCallback(async () => {
    const [allVols, allChs] = await Promise.all([
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])
    const projVols = allVols.sort((a, b) => a.order - b.order)
    const projChs = allChs.sort((a, b) => a.order - b.order)

    // 首次启动：写入种子卷章（仅当该项目无任何数据）
    if (projVols.length === 0 && projChs.length === 0) {
      const now = clock.now()
      const seedVols = buildSeedVolumes(projectId, idGenerator, clock).map((v) => ({
        ...v,
        createdAt: now,
        updatedAt: now,
      }))
      const firstVolumeId = seedVols[0]?.id
      const seedChs = buildSeedChapters(projectId, firstVolumeId, idGenerator, clock).map((c) => ({
        ...c,
        createdAt: now,
        updatedAt: now,
      }))
      for (const v of seedVols) {
        if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(v)))) return
      }
      for (const c of seedChs) {
        if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(c)))) return
      }
      const init: Record<string, boolean> = {}
      seedVols.forEach((v) => (init[v.id] = true))
      patch({
        volumes: seedVols,
        chapters: seedChs,
        expanded: init,
        activeChapterId: seedChs[0]?.id ?? '',
        activeChapter: seedChs[0] ?? null,
      })
      return
    }

    const init: Record<string, boolean> = {}
    projVols.forEach((v) => (init[v.id] = true))

    // P0.3 & P1.3: 优先恢复上次阅读/写作的章节，并检测是否存在未经存盘的草稿日记 (Draft WAL Crash Recovery)
    const lastChapterKey = `inkpi_last_active_chapter:${projectId}`
    let initialChapter = projChs[0] ?? null
    const savedChapterId = await kvStoreRef.current.get(lastChapterKey)
    if (savedChapterId) {
      const found = projChs.find((c) => c.id === savedChapterId)
      if (found) initialChapter = found
    }

    if (initialChapter) {
      const draft = draftJournal.get(projectId, initialChapter.id)
      const currentRev = initialChapter.revision ?? 1
      // P1: WAL 严格恢复条件 (baseRevision === currentRev 自动恢复；< 为过时冲突；> 为异常)
      if (
        draft &&
        draft.baseRevision === currentRev &&
        draft.updatedAt > (initialChapter.updatedAt || 0) &&
        draft.editorContent
      ) {
        initialChapter = {
          ...initialChapter,
          content: draft.editorContent,
          wordCount: countWords(draft.editorContent),
          updatedAt: draft.updatedAt,
        }
      }
    }

    patch({
      volumes: projVols,
      chapters: projChs,
      expanded: init,
      activeChapterId: initialChapter?.id ?? '',
      activeChapter: initialChapter,
    })
  }, [projectId, patch, runPersistence])

  useEffect(() => {
    void loadData().catch(reportSaveError)

    const handleBeforeUnload = () => {
      // 窗口关闭或刷新时执行强制落盘，杜绝丢稿 (INV-01)
      if (autosave.hasPending()) {
        void autosave.drain().catch(() => {})
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Tauri 原生窗口关闭拦截：防止用户直接点击原生 X 导致未落盘数据丢失
    let unlistenTauriClose: (() => void) | undefined
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          const appWindow = getCurrentWindow()
          return appWindow.onCloseRequested(async (event) => {
            if (autosave.hasPending()) {
              event.preventDefault()
              try {
                await autosave.drain()
                await appWindow.destroy()
              } catch (err) {
                reportSaveError(err)
              }
            }
          })
        })
        .then((unlisten) => {
          unlistenTauriClose = unlisten
        })
        .catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (unlistenTauriClose) {
        unlistenTauriClose()
      }
      // 组件卸载时强制原子 flush 而非仅仅 cancel
      if (autosave.hasPending()) {
        void autosave.flush().catch(() => {})
      }
      autosave.cancel()
      if (ghostTimer.current) clearTimeout(ghostTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const activateChapter = useCallback(
    async (nextChapter: ChapterRecord | null) => {
      // 切换章节前强制等待当前正在防抖/暂存的草稿全部 durable 落盘，杜绝切章竞态丢稿 (INV-01)
      if (autosave.hasPending()) {
        try {
          await autosave.drain()
        } catch (err) {
          reportSaveError(err)
        }
      }
      if (nextChapter) {
        void kvStoreRef.current.set(`inkpi_last_active_chapter:${projectId}`, nextChapter.id)
      }
      activeChapterRef.current = nextChapter
      patch({
        activeChapterId: nextChapter?.id ?? '',
        activeChapter: nextChapter,
        isSaved: true,
      })
    },
    [patch, autosave, reportSaveError, projectId],
  )

  const selectChapter = useCallback(
    (ch: ChapterRecord) => {
      void activateChapter(ch)
    },
    [activateChapter],
  )

  const toggleVolume = useCallback(
    (id: string) => {
      const prev = stateRef.current.expanded
      patch({ expanded: { ...prev, [id]: !prev[id] } })
    },
    [patch],
  )

  const handleNewVolume = useCallback(async () => {
    const { volumes } = stateRef.current
    const order = volumes.length
    const title = `第${order + 1}卷`
    const vol: VolumeRecord = {
      id: idGenerator.generate('vol'),
      projectId,
      title,
      order,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    }
    if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(vol)))) return
    patch({
      volumes: [...volumes, vol],
      expanded: { ...stateRef.current.expanded, [vol.id]: true },
    })
  }, [projectId, patch, runPersistence])

  const handleNewChapter = useCallback(
    async (targetVolumeId?: string) => {
      const { volumes, chapters, activeChapter } = stateRef.current
      let volId =
        targetVolumeId ||
        activeChapter?.volumeId ||
        (volumes.length > 0 ? volumes[volumes.length - 1].id : undefined)
      if (!volId) {
        const vol: VolumeRecord = {
          id: idGenerator.generate('vol'),
          projectId,
          title: '第一卷',
          order: 0,
          createdAt: clock.now(),
          updatedAt: clock.now(),
        }
        if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(vol)))) return
        patch({
          volumes: [...volumes, vol],
          expanded: { ...stateRef.current.expanded, [vol.id]: true },
        })
        volId = vol.id
      }
      const order = chapters.filter((c) => c.volumeId === volId).length
      const ch: ChapterRecord = {
        id: idGenerator.generate('ch'),
        projectId,
        volumeId: volId,
        title: composeChapterTitle(order),
        content: blankChapterContent(),
        wordCount: 0,
        order,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(ch)))) return
      patch({
        chapters: [...stateRef.current.chapters, ch],
        expanded: { ...stateRef.current.expanded, [volId]: true },
      })
      await activateChapter(ch)
    },
    [projectId, patch, runPersistence, activateChapter],
  )

  const renameChapter = useCallback(
    async (chapter: ChapterRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === chapter.title) {
        patch({ renamingChapter: null })
        return
      }
      const updated = { ...chapter, title: trimmed, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      const next: Partial<EditorModelState> = { chapters, renamingChapter: null }
      if (stateRef.current.activeChapterId === updated.id) {
        next.activeChapter = updated
        onStats?.({
          title: updated.title,
          wordCount: updated.wordCount,
          updatedAt: updated.updatedAt,
        })
      }
      patch(next)
    },
    [onStats, patch, runPersistence],
  )

  const deleteChapter = useCallback(
    async (chapter: ChapterRecord) => {
      if (!(await runPersistence(() => indexedDbProjectRepository.deleteChapter(chapter.id))))
        return
      const nextList = stateRef.current.chapters.filter((c) => c.id !== chapter.id)
      patch({ chapters: nextList, deletingChapter: null })
      if (stateRef.current.activeChapterId === chapter.id) {
        await activateChapter(nextList.length > 0 ? nextList[0] : null)
      }
    },
    [patch, runPersistence, activateChapter],
  )

  const renameVolume = useCallback(
    async (volume: VolumeRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === volume.title) {
        patch({ renamingVolume: null })
        return
      }
      const updated = { ...volume, title: trimmed, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveVolume(updated)))) return
      const volumes = stateRef.current.volumes.map((v) => (v.id === updated.id ? updated : v))
      patch({ volumes, renamingVolume: null })
    },
    [patch, runPersistence],
  )

  const deleteVolume = useCallback(
    async (volume: VolumeRecord) => {
      if (!(await runPersistence(() => indexedDbProjectRepository.deleteVolume(volume.id)))) return
      const volumes = stateRef.current.volumes.filter((v) => v.id !== volume.id)
      const fallbackVolId = volumes[0]?.id
      let chapters = stateRef.current.chapters
      let persistenceFailed = false
      if (fallbackVolId) {
        chapters = await Promise.all(
          chapters.map(async (ch) => {
            if (ch.volumeId === volume.id) {
              const updated = { ...ch, volumeId: fallbackVolId, updatedAt: clock.now() }
              if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) {
                persistenceFailed = true
                return ch
              }
              return updated
            }
            return ch
          }),
        )
        if (persistenceFailed) return
      } else {
        // 无其余分卷时，删除该卷下所有章节
        for (const ch of chapters.filter((c) => c.volumeId === volume.id)) {
          if (!(await runPersistence(() => indexedDbProjectRepository.deleteChapter(ch.id)))) return
        }
        chapters = chapters.filter((c) => c.volumeId !== volume.id)
      }
      patch({ volumes, chapters, deletingVolume: null })
    },
    [patch, runPersistence],
  )

  const moveChapterToVolume = useCallback(
    async (chapter: ChapterRecord, targetVolumeId: string) => {
      if (chapter.volumeId === targetVolumeId) return
      const order = stateRef.current.chapters.filter((c) => c.volumeId === targetVolumeId).length
      const updated = { ...chapter, volumeId: targetVolumeId, order, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      const next: Partial<EditorModelState> = {
        chapters,
        expanded: { ...stateRef.current.expanded, [targetVolumeId]: true },
      }
      if (stateRef.current.activeChapterId === updated.id) {
        next.activeChapter = updated
      }
      patch(next)
    },
    [patch, runPersistence],
  )

  const duplicateChapter = useCallback(
    async (source: ChapterRecord) => {
      const order = stateRef.current.chapters.filter((c) => c.volumeId === source.volumeId).length
      const copyCh: ChapterRecord = {
        id: idGenerator.generate('ch'),
        projectId: source.projectId,
        volumeId: source.volumeId,
        title: `${source.title} (副本)`,
        content: source.content || blankChapterContent(),
        wordCount: source.wordCount || 0,
        order,
        status: 'draft',
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(copyCh)))) return
      patch({
        chapters: [...stateRef.current.chapters, copyCh],
      })
      await activateChapter(copyCh)
    },
    [patch, runPersistence, activateChapter],
  )

  const copyChapterText = useCallback(
    async (chapter: ChapterRecord) => {
      try {
        const plain = htmlToPlain(chapter.content || '')
        await clipboardWriter.writeText(`${chapter.title}\n\n${plain}`)
        patch({ copiedChapterId: chapter.id })
        setTimeout(() => patch({ copiedChapterId: null }), 2000)
      } catch {
        /* ignore */
      }
    },
    [patch],
  )

  const exportSingleChapter = useCallback((chapter: ChapterRecord, format: 'txt' | 'md') => {
    const plain = htmlToPlain(chapter.content || '')
    const content =
      format === 'md' ? `# ${chapter.title}\n\n${plain}` : `${chapter.title}\n\n${plain}`
    const blob = new Blob([content], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    })
    blobFileDownloader.downloadBlob(`${chapter.title}.${format}`, blob)
  }, [])

  const setStatus = useCallback(
    async (status: ChapterStatus) => {
      const cur = stateRef.current.activeChapter
      if (!cur) return
      const updated = { ...cur, status, updatedAt: clock.now() }
      if (!(await runPersistence(() => indexedDbProjectRepository.saveChapter(updated)))) return
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      patch({ chapters, activeChapter: updated })
      onStats?.({
        title: updated.title,
        wordCount: updated.wordCount,
        updatedAt: updated.updatedAt,
      })
    },
    [onStats, patch, runPersistence],
  )

  const setCanvasWidth = useCallback(
    (next: CanvasWidth) => {
      patch({ canvasWidth: next })
      void kvStoreRef.current.set('inkpi-editor-canvas-width', next)
    },
    [patch],
  )

  const toggleExcludeNumbering = useCallback(
    (chId: string) => {
      const next = new Set(stateRef.current.excludedNumberingIds)
      if (next.has(chId)) next.delete(chId)
      else next.add(chId)
      void kvStoreRef.current.set(
        `inkpi-excluded-nums-${projectId}`,
        JSON.stringify(Array.from(next)),
      )
      patch({ excludedNumberingIds: next })
    },
    [projectId, patch],
  )

  const autoFormat = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return
    const text = ed.getText()
    const { normalizePunctuationOnFormat: norm, paragraphIndent: indent } = settingsRef.current
    const formatted = norm ? fixPunctuation(text, indent) : formatChineseParagraphs(text, indent)
    void applyContentMutation(ed, formatted, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const formatWithPreset = useCallback(
    (preset: TypographyPreset) => {
      const ed = editorRef.current
      const cur = activeChapterRef.current
      if (!ed || ed.isDestroyed || !cur) return
      const formatted = formatByPreset(ed.getHTML() || ed.getText(), preset)
      void applyContentMutation(ed, formatted, {
        workspaceId: projectId,
        chapterId: cur.id,
        expectedRevision: cur.revision,
        origin: 'format',
      }).then((updated) => {
        if (updated) {
          activeChapterRef.current = updated
          patch({
            activeChapter: updated,
            chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
            isSaved: true,
          })
        }
      })
    },
    [editorRef, patch, projectId],
  )

  const punctuationFix = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return
    const fixed = fixPunctuation(ed.getText())
    void applyContentMutation(ed, fixed, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const executeReplace = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    const find = stateRef.current.findText
    if (!ed || ed.isDestroyed || !find || !cur) return
    const replaced = applyFindReplace(ed.getHTML(), find, stateRef.current.replaceText)
    void applyContentMutation(ed, replaced, {
      workspaceId: projectId,
      chapterId: cur.id,
      expectedRevision: cur.revision,
      origin: 'format',
    }).then((updated) => {
      if (updated) {
        activeChapterRef.current = updated
        patch({
          activeChapter: updated,
          chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
          isSaved: true,
        })
      }
    })
  }, [editorRef, patch, projectId])

  const setGhostText = useCallback(
    (v: string) => {
      ghostTextRef.current = v
      patch({ ghostText: v })
    },
    [patch],
  )

  const acceptGhostText = useCallback(() => {
    const ed = editorRef.current
    if (ed && !ed.isDestroyed && stateRef.current.ghostText) {
      ed.commands.insertContent(stateRef.current.ghostText)
      setGhostText('')
    }
  }, [editorRef, patch, setGhostText])

  const findMatchesInDoc = useCallback(
    (query: string): { from: number; to: number }[] => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed || !query) return []
      const doc = ed.state?.doc
      if (!doc || typeof doc.descendants !== 'function') return []
      const lower = query.toLowerCase()
      const results: { from: number; to: number }[] = []
      ed.state.doc.descendants((node: any, pos: number) => {
        if (!node.isText) return
        const t = node.text || ''
        let idx = t.toLowerCase().indexOf(lower)
        while (idx !== -1) {
          results.push({ from: pos + idx, to: pos + idx + query.length })
          idx = t.toLowerCase().indexOf(lower, idx + query.length)
        }
      })
      return results
    },
    [editorRef],
  )

  const runGlobalSearch = useCallback(async () => {
    const q = stateRef.current.globalQuery.trim()
    if (!q) {
      patch({ globalResults: [] })
      return
    }
    const proj = await indexedDbProjectRepository.getChaptersByProject(projectId)
    const res: GlobalSearchResult[] = []
    for (const ch of proj) {
      const plain = htmlToPlain(ch.content || '')
      const idx = plain.indexOf(q)
      if (idx === -1) continue
      const count = plain.split(q).length - 1
      const start = Math.max(0, idx - 24)
      const snippet = plain
        .substring(start, start + 64)
        .replace(/\s+/g, ' ')
        .trim()
      res.push({ chapterId: ch.id, title: ch.title, snippet, count })
    }
    res.sort((a, b) => b.count - a.count)
    patch({ globalResults: res })
  }, [projectId, patch])

  const jumpToChapterFromSearch = useCallback(
    (r: GlobalSearchResult) => {
      const ch = stateRef.current.chapters.find((c) => c.id === r.chapterId)
      if (ch) {
        patch({
          showGlobalSearch: false,
          findText: stateRef.current.globalQuery.trim(),
          showFindReplace: true,
        })
        void activateChapter(ch)
      } else {
        patch({ showGlobalSearch: false })
      }
    },
    [patch, activateChapter],
  )

  const updateActiveTitle = useCallback(
    (title: string) => {
      const cur = stateRef.current.activeChapter
      if (!cur) return
      const updated = { ...cur, title }
      patch({
        activeChapter: updated,
        chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
        isSaved: false,
      })
    },
    [patch],
  )

  const handleEditorUpdate = useCallback(() => {
    const ed = editorRef.current
    const cur = activeChapterRef.current
    if (!ed || ed.isDestroyed || !cur) return

    const html = ed.getHTML()
    const text = ed.getText()
    const wc = countWords(text)
    const diff = wc - cur.wordCount

    // P0-1: 键盘输入仅更新 transient 内容，不任意 revision++，保持与 durable revision 对齐
    const updated: ChapterRecord = {
      ...cur,
      content: html,
      wordCount: wc,
      revision: cur.revision ?? 1,
      updatedAt: clock.now(),
    }
    activeChapterRef.current = updated
    patch({
      activeChapter: updated,
      chapters: stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c)),
      isSaved: false,
      sessionWordDelta: stateRef.current.sessionWordDelta + (diff > 0 ? diff : 0),
    })

    // 行内 Ghost Text 续写：防抖请求
    if (onRequestGhostRef.current && text.length > 5) {
      if (ghostTimer.current) clearTimeout(ghostTimer.current)
      const tail = text.slice(-200)
      const chId = cur.id
      ghostTimer.current = setTimeout(() => {
        onRequestGhostRef.current!(chId, tail)
          .then((suggestion) => {
            if (suggestion) {
              setGhostText(suggestion)
              showGhostText(ed, suggestion)
            }
          })
          .catch(() => {})
      }, 600)
    }

    // P0.3: 用户打字时写入轻量本地草稿日记 (Draft WAL)，防范系统闪退 (INV-01)
    draftJournal.record({
      workspaceId: projectId,
      chapterId: cur.id,
      baseRevision: cur.revision ?? 1,
      editorContent: html,
      updatedAt: clock.now(),
    })

    // 防抖自动存盘到 IndexedDB（受「自动保存」设置控制）
    if (settingsRef.current.autoSave) {
      autosave.schedule(updated, settingsRef.current.autoSaveDelay)
    }
  }, [editorRef, patch, setGhostText, autosave])

  const save = useCallback(() => {
    void flushSave().catch(reportSaveError)
  }, [flushSave, reportSaveError])

  // ── 切换章节时把内容灌入编辑器（不覆盖正在进行的输入）──
  useEffect(() => {
    activeChapterRef.current = state.activeChapter
  }, [state.activeChapter])

  // 全文检索（文档内）：检索词变化时，重算匹配并跳到首个
  useEffect(() => {
    const ed = editorRef.current
    const find = state.findText
    if (!ed || ed.isDestroyed) return
    if (!find) {
      patch({ matchPositions: [], activeMatch: 0 })
      return
    }
    const res = findMatchesInDoc(find)
    patch({ matchPositions: res, activeMatch: 0 })
    if (res.length > 0) {
      ed.commands.setTextSelection({ from: res[0].from, to: res[0].to })
      ed.commands.scrollIntoView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.findText])

  // 上报统计给外层引擎（右侧信息栏）
  useEffect(() => {
    onStats?.({
      title: state.activeChapter?.title,
      wordCount: state.activeChapter?.wordCount ?? 0,
      updatedAt: state.activeChapter?.updatedAt,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeChapter])

  /* ── 派生数据 ──────────────────────────────────────────── */
  const linearChapters = state.volumes.flatMap((v) =>
    state.chapters.filter((c) => c.volumeId === v.id).sort((a, b) => a.order - b.order),
  )
  const currentChapterIndex = linearChapters.findIndex((c) => c.id === state.activeChapterId)

  const treeQueryTrimmed = state.treeQuery.trim().toLowerCase()
  const filteredVolumes = state.volumes
    .map((vol) => {
      const volChs = state.chapters
        .filter((c) => c.volumeId === vol.id)
        .sort((a, b) => a.order - b.order)
      const matchedChs = treeQueryTrimmed
        ? volChs.filter((c) => c.title.toLowerCase().includes(treeQueryTrimmed))
        : volChs
      return { vol, chs: matchedChs, total: volChs.length }
    })
    .filter(
      ({ vol, chs, total }) =>
        !treeQueryTrimmed ||
        chs.length > 0 ||
        (vol.title.toLowerCase().includes(treeQueryTrimmed) && total > 0),
    )

  const chapterNumberMap = (() => {
    const map = new Map<string, string>()
    let currentNum = 1
    // 若标题中已包含显式序数词（如 "第001章", "第1章", "01 ", "Chapter 1"），则无需再机械式前置数字
    const hasExplicitNumbering =
      /^(第\s*[\d一二三四五六七八九十百千]+\s*[章节回节篇卷]|chapter\s*\d+|\d{1,4}[.\s、_-])/i
    for (const ch of linearChapters) {
      if (state.excludedNumberingIds.has(ch.id) || hasExplicitNumbering.test(ch.title.trim())) {
        map.set(ch.id, '')
      } else {
        map.set(ch.id, String(currentNum))
        currentNum++
      }
    }
    return map
  })()

  const breadcrumb = (() => {
    const ac = state.activeChapter
    if (!ac) return ''
    const volIdx = state.volumes.findIndex((v) => v.id === ac.volumeId)
    if (volIdx < 0) return ''
    const volChs = state.chapters
      .filter((c) => c.volumeId === ac.volumeId)
      .sort((a, b) => a.order - b.order)
    const chIdx = volChs.findIndex((c) => c.id === ac.id)
    if (chIdx < 0) return ''
    return `第${volIdx + 1}卷 · 第${chIdx + 1}章`
  })()

  const totalWords = state.chapters.reduce((acc, c) => acc + c.wordCount, 0)
  const chapterWords = state.activeChapter?.wordCount || 0
  const fontStack = fontStackFor(fontFamily)

  const prevChapter = useCallback(() => {
    if (currentChapterIndex > 0) selectChapter(linearChapters[currentChapterIndex - 1])
  }, [currentChapterIndex, linearChapters, selectChapter])

  const nextChapter = useCallback(() => {
    if (currentChapterIndex >= 0 && currentChapterIndex < linearChapters.length - 1) {
      selectChapter(linearChapters[currentChapterIndex + 1])
    }
  }, [currentChapterIndex, linearChapters, selectChapter])

  const actions: ChapterEditorActions = {
    selectChapter,
    prevChapter,
    nextChapter,
    toggleVolume,
    newChapter: handleNewChapter,
    newVolume: handleNewVolume,
    renameChapter,
    deleteChapter,
    renameVolume,
    deleteVolume,
    moveChapterToVolume,
    duplicateChapter,
    copyChapterText,
    exportSingleChapter,
    exportChapter: (format: 'txt' | 'md' | 'html') => {
      const ed = editorRef.current
      const ac = stateRef.current.activeChapter
      if (!ac || !ed || ed.isDestroyed) return
      const output =
        format === 'html'
          ? renderChapterHtmlDocument(ac.title, ed.getHTML())
          : exportChapter(ed.getHTML(), format, ac.title)
      const blob = new Blob([output], {
        type: format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8',
      })
      blobFileDownloader.downloadBlob(`${ac.title}.${format}`, blob)
    },
    setStatus,
    setCanvasWidth,
    toggleExcludeNumbering,
    autoFormat,
    formatWithPreset,
    punctuationFix,
    executeReplace,
    acceptGhostText,
    runGlobalSearch,
    jumpToChapterFromSearch,
    updateActiveTitle,
    handleEditorUpdate,
    save,
    setGhostText,
    setSidebar: (v: boolean) => patch({ isSidebarOpen: v }),
    setShowFindReplace: (v: boolean) => patch({ showFindReplace: v }),
    setShowSensitiveModal: (v: boolean) => patch({ showSensitiveModal: v }),
    setShowLockModal: (v: boolean) => patch({ showLockModal: v }),
    setShowHistoryModal: (v: boolean) => patch({ showHistoryModal: v }),
    setShowOveruseModal: (v: boolean) => patch({ showOveruseModal: v }),
    setShowSplitView: (v: boolean) => patch({ showSplitView: v }),
    setShowScratchpad: (v: boolean) => patch({ showScratchpad: v }),
    setShowWordCountPanelModal: (v: boolean) => patch({ showWordCountPanelModal: v }),
    setShowBackgroundModal: (v: boolean) => patch({ showBackgroundModal: v }),
    setShowFontFormatModal: (v: boolean) => patch({ showFontFormatModal: v }),
    setShowGlobalSearch: (v: boolean) => patch({ showGlobalSearch: v }),
    setChapterContextMenu: (v) => patch({ chapterContextMenu: v }),
    setRenamingChapter: (v) => patch({ renamingChapter: v }),
    setRenamingTitle: (v) => patch({ renamingTitle: v }),
    setDeletingChapter: (v) => patch({ deletingChapter: v }),
    setCopiedChapterId: (v) => patch({ copiedChapterId: v }),
    setRenamingVolume: (v) => patch({ renamingVolume: v }),
    setRenamingVolumeTitle: (v) => patch({ renamingVolumeTitle: v }),
    setDeletingVolume: (v) => patch({ deletingVolume: v }),
    setVolumeContextMenu: (v) => patch({ volumeContextMenu: v }),
    setTreeQuery: (v) => patch({ treeQuery: v }),
    setGlobalQuery: (v) => patch({ globalQuery: v }),
    setFindText: (v) => patch({ findText: v }),
    setReplaceText: (v) => patch({ replaceText: v }),
    setActiveMatch: (v) => patch({ activeMatch: v }),
    refreshData: loadData,
  }

  return {
    ...state,
    linearChapters,
    currentChapterIndex,
    filteredVolumes,
    chapterNumberMap,
    breadcrumb,
    totalWords,
    chapterWords,
    fontStack,
    fontSize,
    lineHeight,
    fontFamily,
    paragraphSpacing,
    wordTarget,
    showStatsBar,
    defaultTypewriter,
    ghostTextRef,
    actions,
    updateSettings,
  }
}

/** 编辑器模型类型：状态 + 派生值 + actions + ghostTextRef，供 organisms 以 props 接收 */
export type EditorModel = ReturnType<typeof useChapterEditorModel>
>>>>>>> theirs
