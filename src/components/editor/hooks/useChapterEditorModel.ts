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

  const flushSave = useCallback(
    async (ch?: ChapterRecord) => {
      const target = ch ?? activeChapterRef.current
      if (!target) return
      await indexedDbProjectRepository.saveChapter(target)
      saveSnapshot(target)
      patch({ isSaved: true })
      onStats?.({ title: target.title, wordCount: target.wordCount, updatedAt: target.updatedAt })
    },
    [onStats, patch],
  )

  const autosave = useChapterAutosave(flushSave)

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
      for (const v of seedVols) await indexedDbProjectRepository.saveVolume(v)
      for (const c of seedChs) await indexedDbProjectRepository.saveChapter(c)
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
    patch({
      volumes: projVols,
      chapters: projChs,
      expanded: init,
      activeChapterId: projChs[0]?.id ?? '',
      activeChapter: projChs[0] ?? null,
    })
  }, [projectId, patch])

  useEffect(() => {
    void loadData()
    return () => {
      autosave.cancel()
      if (ghostTimer.current) clearTimeout(ghostTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const selectChapter = useCallback(
    (ch: ChapterRecord) => {
      patch({ activeChapterId: ch.id, activeChapter: ch, isSaved: true })
    },
    [patch],
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
    await indexedDbProjectRepository.saveVolume(vol)
    patch({
      volumes: [...volumes, vol],
      expanded: { ...stateRef.current.expanded, [vol.id]: true },
    })
  }, [projectId, patch])

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
        await indexedDbProjectRepository.saveVolume(vol)
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
      await indexedDbProjectRepository.saveChapter(ch)
      patch({
        chapters: [...stateRef.current.chapters, ch],
        activeChapterId: ch.id,
        activeChapter: ch,
        expanded: { ...stateRef.current.expanded, [volId]: true },
        isSaved: true,
      })
    },
    [projectId, patch],
  )

  const renameChapter = useCallback(
    async (chapter: ChapterRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === chapter.title) {
        patch({ renamingChapter: null })
        return
      }
      const updated = { ...chapter, title: trimmed, updatedAt: clock.now() }
      await indexedDbProjectRepository.saveChapter(updated)
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
    [onStats, patch],
  )

  const deleteChapter = useCallback(
    async (chapter: ChapterRecord) => {
      await indexedDbProjectRepository.deleteChapter(chapter.id)
      const nextList = stateRef.current.chapters.filter((c) => c.id !== chapter.id)
      const next: Partial<EditorModelState> = { chapters: nextList, deletingChapter: null }
      if (stateRef.current.activeChapterId === chapter.id) {
        if (nextList.length > 0) {
          next.activeChapterId = nextList[0].id
          next.activeChapter = nextList[0]
        } else {
          next.activeChapterId = ''
          next.activeChapter = null
        }
      }
      patch(next)
    },
    [patch],
  )

  const renameVolume = useCallback(
    async (volume: VolumeRecord, newTitle: string) => {
      const trimmed = newTitle.trim()
      if (!trimmed || trimmed === volume.title) {
        patch({ renamingVolume: null })
        return
      }
      const updated = { ...volume, title: trimmed, updatedAt: clock.now() }
      await indexedDbProjectRepository.saveVolume(updated)
      const volumes = stateRef.current.volumes.map((v) => (v.id === updated.id ? updated : v))
      patch({ volumes, renamingVolume: null })
    },
    [patch],
  )

  const deleteVolume = useCallback(
    async (volume: VolumeRecord) => {
      await indexedDbProjectRepository.deleteVolume(volume.id)
      const volumes = stateRef.current.volumes.filter((v) => v.id !== volume.id)
      const fallbackVolId = volumes[0]?.id
      let chapters = stateRef.current.chapters
      if (fallbackVolId) {
        chapters = await Promise.all(
          chapters.map(async (ch) => {
            if (ch.volumeId === volume.id) {
              const updated = { ...ch, volumeId: fallbackVolId, updatedAt: clock.now() }
              await indexedDbProjectRepository.saveChapter(updated)
              return updated
            }
            return ch
          }),
        )
      } else {
        // 无其余分卷时，删除该卷下所有章节
        for (const ch of chapters.filter((c) => c.volumeId === volume.id)) {
          await indexedDbProjectRepository.deleteChapter(ch.id)
        }
        chapters = chapters.filter((c) => c.volumeId !== volume.id)
      }
      patch({ volumes, chapters, deletingVolume: null })
    },
    [patch],
  )

  const moveChapterToVolume = useCallback(
    async (chapter: ChapterRecord, targetVolumeId: string) => {
      if (chapter.volumeId === targetVolumeId) return
      const order = stateRef.current.chapters.filter((c) => c.volumeId === targetVolumeId).length
      const updated = { ...chapter, volumeId: targetVolumeId, order, updatedAt: clock.now() }
      await indexedDbProjectRepository.saveChapter(updated)
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
    [patch],
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
      await indexedDbProjectRepository.saveChapter(copyCh)
      patch({
        chapters: [...stateRef.current.chapters, copyCh],
        activeChapterId: copyCh.id,
        activeChapter: copyCh,
      })
    },
    [patch],
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
      await indexedDbProjectRepository.saveChapter(updated)
      const chapters = stateRef.current.chapters.map((c) => (c.id === updated.id ? updated : c))
      patch({ chapters, activeChapter: updated })
      onStats?.({
        title: updated.title,
        wordCount: updated.wordCount,
        updatedAt: updated.updatedAt,
      })
    },
    [onStats, patch],
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
    if (!ed || ed.isDestroyed) return
    const text = ed.getText()
    const { normalizePunctuationOnFormat: norm, paragraphIndent: indent } = settingsRef.current
    const formatted = norm ? fixPunctuation(text, indent) : formatChineseParagraphs(text, indent)
    ed.commands.setContent(formatted)
    patch({ isSaved: false })
  }, [editorRef, patch])

  const formatWithPreset = useCallback(
    (preset: TypographyPreset) => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      const formatted = formatByPreset(ed.getHTML() || ed.getText(), preset)
      ed.commands.setContent(formatted)
      patch({ isSaved: false })
    },
    [editorRef, patch],
  )

  const punctuationFix = useCallback(() => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return
    ed.commands.setContent(fixPunctuation(ed.getText()))
    patch({ isSaved: false })
  }, [editorRef, patch])

  const executeReplace = useCallback(() => {
    const ed = editorRef.current
    const find = stateRef.current.findText
    if (!ed || ed.isDestroyed || !find) return
    ed.commands.setContent(applyFindReplace(ed.getHTML(), find, stateRef.current.replaceText))
    patch({ isSaved: false })
  }, [editorRef, patch])

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
          activeChapterId: ch.id,
          activeChapter: ch,
          isSaved: true,
          showGlobalSearch: false,
          findText: stateRef.current.globalQuery.trim(),
          showFindReplace: true,
        })
      } else {
        patch({ showGlobalSearch: false })
      }
    },
    [patch],
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

    const updated: ChapterRecord = {
      ...cur,
      content: html,
      wordCount: wc,
      updatedAt: clock.now(),
    }
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

    // 防抖自动存盘到 IndexedDB（受「自动保存」设置控制）
    if (settingsRef.current.autoSave) {
      autosave.schedule(updated, settingsRef.current.autoSaveDelay)
    }
  }, [editorRef, patch, setGhostText, autosave])

  const save = useCallback(() => {
    void flushSave()
  }, [flushSave])

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
