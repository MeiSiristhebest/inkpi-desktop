import { useEffect, useRef, useCallback, useState, type FC } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'

import { GhostText, clearGhostText as hideGhostText } from '../../extensions/ghost-text'
import { QuoteHighlight } from '../../extensions/quote-highlight'
import { SmartQuotes } from '../../extensions/smart-quotes'
import { EntityHighlight, entityHighlightPluginKey } from '../../extensions/entity-highlight'
import { useChapterEditorModel } from './hooks/useChapterEditorModel'
import { SensitiveModal } from './modals/SensitiveModal'
import { LockModal } from './modals/LockModal'
import { HistoryModal } from './modals/HistoryModal'
import { OveruseWordsModal } from './modals/OveruseWordsModal'
import { WordCountPanelModal, type WordCountConfig } from './modals/WordCountPanelModal'
import { DailyGoalModal } from './modals/DailyGoalModal'
import { BackgroundModal, type EditorBackgroundConfig } from './modals/BackgroundModal'
import { FontFormatModal } from './modals/FontFormatModal'
import { FloatingWordCountWidget } from './organisms/FloatingWordCountWidget'
import { useWritingSessionStats } from './hooks/useWritingSessionStats'
import { indexedDbProjectRepository } from '../../adapters/indexedDbProjectRepository'
import { indexedDbCodexEntityRepository } from '../../adapters/indexedDbCodexEntityRepository'
import { localStorageKeyValueStore } from '../../adapters/localStorageKeyValueStore'
import type { ProjectRecord } from '../../types'
import type { CodexEntity } from '../../plugins/living-codex/types'
import { ChapterReferencesSidebar } from '../../plugins/living-codex/components/ChapterReferencesSidebar'

import { ChapterTree } from './organisms/ChapterTree'
import { EditorToolbar } from './organisms/EditorToolbar'
import { FindReplaceBar } from './organisms/FindReplaceBar'
import { StatusFooter } from './organisms/StatusFooter'
import { EditorCanvas } from './organisms/EditorCanvas'
import { GlobalSearchPopup } from './organisms/GlobalSearchPopup'
import { ChapterContextMenu } from './organisms/ChapterContextMenu'
import { RenameChapterDialog } from './organisms/RenameChapterDialog'
import { DeleteChapterDialog } from './organisms/DeleteChapterDialog'
import { RenameVolumeDialog } from './organisms/RenameVolumeDialog'
import { DeleteVolumeDialog } from './organisms/DeleteVolumeDialog'
import { VolumeContextMenu } from './organisms/VolumeContextMenu'
import { DrawerDock } from './organisms/DrawerDock'
import { DesktopPluginHostProvider } from '../../core/pluginHostContext'

export interface RichEditorProps {
  projectId: string
  isTypewriter?: boolean
  /** 底部状态栏切换打字机时通知外层同步（如 Engine 顶栏按钮） */
  onTypewriterChange?: (v: boolean) => void
  /** 外部聚焦模式：隐藏目录、顶栏、状态栏，只保留画布 */
  focusMode?: boolean
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
  onOpenAssistant?: () => void
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
  /** 请求 Daemon 行内续写建议（按章节隔离会话） */
  onRequestGhost?: (chapterId: string, text: string) => Promise<string | null>
  /** 发送指令给 AI 副驾驶（划词润色等） */
  onAiPrompt?: (text: string, chapterId?: string) => void
  /** 顶栏单层合一注入 */
  onHome?: () => void
  onToggleFocus?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onToggleRightPanel?: () => void
  isRightOpen?: boolean
  hasAssistant?: boolean
  isNavOpen?: boolean
  onToggleNav?: () => void
}

/**
 * 被动视图：仅负责 TipTap 内核装配 + 声明式渲染。
 * 所有业务状态与命令来自 useChapterEditorModel（单一 useReducer），
 * 大块展示逻辑下放至 organisms/*，自身不再持有 useState。
 */
export const RichEditor: FC<RichEditorProps> = ({
  projectId,
  isTypewriter = false,
  onTypewriterChange = () => {},
  focusMode = false,
  onStats = () => {},
  onOpenAssistant = () => {},
  isConnected = false,
  isReconnecting = false,
  onReconnect = () => {},
  onRequestGhost = async () => null,
  onAiPrompt = () => {},
  onHome,
  onToggleFocus,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleRightPanel,
  isRightOpen = false,
  hasAssistant,
  isNavOpen = true,
  onToggleNav,
}) => {
  const editorRef = useRef<any>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const ghostTextRef = useRef('')
  const appliedIdRef = useRef('')

  const model = useChapterEditorModel({ projectId, editorRef, onStats, onRequestGhost })
  const {
    activeChapter,
    activeChapterId,
    chapters,
    actions,
    showFindReplace,
    wordTarget,
    chapterWords,
    showGlobalSearch,
    showSensitiveModal,
    showLockModal,
    showHistoryModal,
    showOveruseModal,
    showWordCountPanelModal,
    showBackgroundModal,
    showFontFormatModal,
    chapterContextMenu,
    renamingChapter,
    deletingChapter,
    renamingVolume,
    deletingVolume,
    volumeContextMenu,
    defaultTypewriter,
  } = model

  const effectiveZen = focusMode
  const effectiveTypewriter = isTypewriter || defaultTypewriter

  // 会话打字统计 hook：作品级当天连续累计、防粘贴虚假增量、空闲持续累加
  const sessionStats = useWritingSessionStats({
    projectId,
    isActive: !focusMode,
  })

  // 记录上一次的正文纯文字长度，用于在用户自然打字输入时派发有效打字字数
  const prevChapterLenRef = useRef<number>(activeChapter?.wordCount || 0)
  const isPasteOperationRef = useRef<boolean>(false)

  // 写作背景与网格线配置（默认采用用户最适宜的写作底色与网格设定）
  const [bgConfig, setBgConfig] = useState<EditorBackgroundConfig>(() => {
    try {
      const raw = localStorageKeyValueStore.getSync('inkpi-editor-bg-config')
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return {
      themeMode: 'light',
      skinId: 'mist-gray',
      gridType: 'none',
    }
  })

  // 悬浮小组件开关：默认开启悬浮小组件
  const [showFloatingWidget, setShowFloatingWidget] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [dailyGoalTarget, setDailyGoalTarget] = useState(() => {
    const saved = localStorageKeyValueStore.getSync(`inkpi-daily-goal-${projectId}`)
    return saved ? Number(saved) || 4600 : 4600
  })

  const [widgetConfig, setWidgetConfig] = useState<WordCountConfig>({
    headerType: 'mascot',
    showMascotMotto: true,
    showSessionWords: true,
    showSpeed: true,
    showWritingTime: true,
    showIdleTime: true,
    layout: 'layout2',
  })

  // 设定集实体与正文高亮联动
  const [entities, setEntities] = useState<CodexEntity[]>([])
  const [entityHighlightEnabled, setEntityHighlightEnabled] = useState(true)
  const [showReferencesSidebar, setShowReferencesSidebar] = useState(false)

  // 加载当前项目设定集所有实体（角色、势力、宗门、物品等）
  useEffect(() => {
    let alive = true
    void indexedDbCodexEntityRepository.getAll().then((all) => {
      if (alive) {
        const currentProjectEntities = all.filter((e) => e.projectId === projectId)
        setEntities(currentProjectEntities)
      }
    })
    return () => {
      alive = false
    }
  }, [projectId])

  // 当实体列表更新或高亮开关变动时，实时通知 TipTap ProseMirror 插件重新计算 Decorations
  useEffect(() => {
    const ed = editorRef.current
    if (ed && !ed.isDestroyed && ed.view) {
      const tr = ed.view.state.tr.setMeta(entityHighlightPluginKey, {
        entities,
        enabled: entityHighlightEnabled,
        highlightRole: true,
        highlightSetting: true,
      })
      ed.view.dispatch(tr)
    }
  }, [entities, entityHighlightEnabled])

  // 获取当前书本详情（用于字数面板封面与书名展示）
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null)
  useEffect(() => {
    let alive = true
    if (projectId) {
      void indexedDbProjectRepository.getProject(projectId).then((p) => {
        if (alive && p) setCurrentProject(p)
      })
    }
    return () => {
      alive = false
    }
  }, [projectId])

  const recenterTypewriter = useCallback(() => {
    if (!effectiveTypewriter) return
    const ed = editorRef.current
    const container = canvasRef.current
    if (!ed || ed.isDestroyed || !container) return
    try {
      const { from } = ed.state.selection
      const coords = ed.view.coordsAtPos(from)
      const rect = container.getBoundingClientRect()
      // 将光标所在行平滑保持在编辑器视口 45% 的垂直黄金中线上
      const targetY = rect.top + rect.height * 0.45
      const offset = coords.top - targetY
      if (Math.abs(offset) > 3) {
        container.scrollTop += offset
      }
    } catch {
      /* jsdom 无布局信息，忽略 */
    }
  }, [effectiveTypewriter])

  /* ── TipTap 编辑器内核装配 ─────────────────────────────── */
  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({ placeholder: '在此处挥洒你的灵感与笔墨……' }),
      GhostText,
      QuoteHighlight,
      SmartQuotes,
      EntityHighlight.configure({
        entities,
        enabled: entityHighlightEnabled,
        highlightRole: true,
        highlightSetting: true,
        onEntityClick: (_ent) => {
          // 点击正文高亮实体时，自动展开右侧引用侧栏
          setShowReferencesSidebar(true)
        },
      }),
    ],
    content: activeChapter?.content || '',
    editorProps: {
      handlePaste: (_view, _event) => {
        isPasteOperationRef.current = true
        sessionStats.recordPasteWords(0)
        return false
      },
      handleKeyDown: (_view, event) => {
        // Tab 采纳光标后的内联 Ghost Text 续写
        if (event.key === 'Tab' && ghostTextRef.current) {
          const ed = editorRef.current
          if (!ed || ed.isDestroyed) return false
          const g = ghostTextRef.current
          ghostTextRef.current = ''
          actions.setGhostText('')
          ed.commands.insertContent(g)
          return true
        }
        return false
      },
    },
    onUpdate: () => {
      actions.handleEditorUpdate()
      const currentLen = editorRef.current?.getText()?.replace(/\s+/g, '')?.length || 0
      const delta = currentLen - prevChapterLenRef.current
      prevChapterLenRef.current = currentLen

      if (delta > 0 && !isPasteOperationRef.current) {
        sessionStats.recordTypedWords(delta)
      }
      isPasteOperationRef.current = false
    },
    onTransaction: () => {
      if (effectiveTypewriter) {
        requestAnimationFrame(recenterTypewriter)
      }
    },
    onSelectionUpdate: () => {
      if (effectiveTypewriter) {
        requestAnimationFrame(recenterTypewriter)
      }
    },
  })

  // 严禁在 render 期间给 ref 赋值（React 19 要求 render 为纯函数）。
  // 在 commit 阶段同步写入 ref，保证 editor 实例可用且生命周期正确。
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // 组件卸载时显式销毁 editor，防止 TipTap 在 React 已卸载 DOM 后仍异步操作节点。
  useEffect(() => {
    return () => {
      const ed = editorRef.current
      if (ed && !ed.isDestroyed) {
        try {
          ed.destroy()
        } catch {
          /* ignore cleanup errors */
        }
      }
      editorRef.current = null
    }
  }, [])

  /* ── 切换章节时把内容灌入编辑器（不覆盖正在进行的输入）──── */
  useEffect(() => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || appliedIdRef.current === activeChapterId) return
    const ch = chapters.find((c) => c.id === activeChapterId)
    if (!ch) return
    appliedIdRef.current = activeChapterId
    try {
      ed.commands.setContent(ch.content || '')
      hideGhostText(ed)
      ghostTextRef.current = ''
      actions.setGhostText('')
      prevChapterLenRef.current = ch.content ? ch.wordCount : 0
      isPasteOperationRef.current = true
    } catch {
      /* 编辑器销毁过程中可能短暂不一致，忽略 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeChapterId, chapters])

  /* ── 全局快捷键：⌘S 保存 / ⌘F 查找 / ⌘B 折叠目录 / ⌘N 新建章节 / ⌘H 时光机 / Alt+↑/↓ 切章 / Esc 关闭 ── */
  const uiRef = useRef({
    showFindReplace,
    isSidebarOpen: model.isSidebarOpen,
    prevChapter: actions.prevChapter,
    nextChapter: actions.nextChapter,
    newChapter: actions.newChapter,
    activeChapter,
  })
  uiRef.current = {
    showFindReplace,
    isSidebarOpen: model.isSidebarOpen,
    prevChapter: actions.prevChapter,
    nextChapter: actions.nextChapter,
    newChapter: actions.newChapter,
    activeChapter,
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        actions.setChapterContextMenu(null)
        actions.setRenamingChapter(null)
        actions.setDeletingChapter(null)
        if (uiRef.current.showFindReplace) actions.setShowFindReplace(false)
        actions.setShowHistoryModal(false)
        setShowReferencesSidebar(false)
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        if (uiRef.current.activeChapter) {
          actions.setRenamingChapter(uiRef.current.activeChapter)
          actions.setRenamingTitle(uiRef.current.activeChapter.title)
        }
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          uiRef.current.prevChapter()
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          uiRef.current.nextChapter()
          return
        }
      }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        actions.save()
      } else if (k === 'f') {
        e.preventDefault()
        actions.setShowFindReplace(!uiRef.current.showFindReplace)
      } else if (k === 'b') {
        e.preventDefault()
        actions.setSidebar(!uiRef.current.isSidebarOpen)
      } else if (k === 'n' && !e.shiftKey) {
        e.preventDefault()
        uiRef.current.newChapter()
      } else if (k === 'h') {
        e.preventDefault()
        actions.setShowHistoryModal(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])

  /* ── 打字机视口：保持光标垂直居中 ──────────────────────── */
  useEffect(() => {
    if (effectiveTypewriter) {
      requestAnimationFrame(recenterTypewriter)
    }
  }, [
    activeChapter?.content,
    effectiveTypewriter,
    recenterTypewriter,
    activeChapterId,
    model.fontSize,
    model.lineHeight,
  ])

  /* ── 渲染 ──────────────────────────────────────────────── */
  return (
    <DesktopPluginHostProvider
      projectId={projectId}
      activeChapter={activeChapter}
      volumes={model.volumes}
      chapters={model.chapters}
      onAiPrompt={onAiPrompt}
      isAiConnected={isConnected}
      onRefreshHierarchy={async () => {
        await model.actions.refreshData()
      }}
      onChapterUpdate={(updated) => {
        const ed = editorRef.current
        if (
          ed &&
          !ed.isDestroyed &&
          updated.content !== undefined &&
          ed.getText() !== updated.content
        ) {
          ed.commands.setContent(updated.content)
        }
      }}
    >
      <div className="flex-1 h-full flex min-h-0 relative bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden">
        {/* 左侧分卷/章节目录树（聚焦模式下隐藏） */}
        {!effectiveZen && model.isSidebarOpen && (
          <ChapterTree
            model={model}
            isConnected={isConnected}
            isReconnecting={isReconnecting}
            onReconnect={onReconnect}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 h-full">
          <EditorToolbar
            model={model}
            editor={editor}
            onHome={onHome}
            onToggleFocus={onToggleFocus}
            focusMode={effectiveZen}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            onToggleRightPanel={onToggleRightPanel}
            isRightOpen={isRightOpen}
            hasAssistant={hasAssistant ?? Boolean(onOpenAssistant)}
            isNavOpen={isNavOpen}
            onToggleNav={onToggleNav}
            showReferencesSidebar={showReferencesSidebar}
            onToggleReferencesSidebar={() => setShowReferencesSidebar((v) => !v)}
            entityHighlightEnabled={entityHighlightEnabled}
            onToggleEntityHighlight={() => setEntityHighlightEnabled((v) => !v)}
          />

          {showFindReplace && !effectiveZen && (
            <FindReplaceBar model={model} editorRef={editorRef} />
          )}

          {/* 字数目标进度条 */}
          {!effectiveZen && wordTarget > 0 && (
            <div
              data-testid="chapter-progress"
              className="shrink-0 h-1 w-full bg-[var(--ink-bg-hover)]"
            >
              <div
                className="h-full bg-[var(--ink-accent)] transition-all duration-300 ease-[var(--ink-ease)]"
                style={{
                  width: `${Math.min(100, Math.round((chapterWords / wordTarget) * 100))}%`,
                }}
              />
            </div>
          )}

          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            <EditorCanvas
              model={model}
              editor={editor}
              canvasRef={canvasRef}
              effectiveZen={effectiveZen}
              effectiveTypewriter={effectiveTypewriter}
              projectId={projectId}
              onAiPrompt={onAiPrompt}
              onOpenAssistant={onOpenAssistant}
              bgConfig={bgConfig}
            />

            {/* 本章引用侧栏（角色/设定条目列表，支持点击直达） */}
            <ChapterReferencesSidebar
              isOpen={showReferencesSidebar && !effectiveZen}
              entities={entities}
              currentText={activeChapter?.content || ''}
              onClose={() => setShowReferencesSidebar(false)}
              onSelectEntity={(ent) => {
                // 点击词条后，在正文中高亮并直接聚焦查找，亦可通过事件总线打开设定详情
                actions.setShowFindReplace(true)
                actions.setFindText(ent.name)
              }}
            />

            <DrawerDock projectId={projectId} currentText={activeChapter?.content || ''} />
          </div>

          {!effectiveZen && model.showStatsBar && (
            <StatusFooter
              model={model}
              isTypewriter={isTypewriter}
              onTypewriterChange={onTypewriterChange}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              onReconnect={onReconnect}
            />
          )}
        </div>

        {showGlobalSearch && <GlobalSearchPopup model={model} />}

        {/* 敏感词即时检测浮层 */}
        {showSensitiveModal && (
          <SensitiveModal
            content={activeChapter?.content || ''}
            onApply={(newContent) => {
              const ed = editorRef.current
              if (ed && !ed.isDestroyed) ed.commands.setContent(newContent)
            }}
            onClose={() => actions.setShowSensitiveModal(false)}
          />
        )}

        {/* 小黑屋强制码字浮层 */}
        {showLockModal && (
          <LockModal
            currentWordCount={chapterWords}
            onClose={() => actions.setShowLockModal(false)}
          />
        )}

        {/* 时光机历史版本浮层 */}
        {showHistoryModal && activeChapter && (
          <HistoryModal
            chapter={activeChapter}
            onRestore={(content) => {
              const ed = editorRef.current
              if (ed && !ed.isDestroyed) ed.commands.setContent(content)
            }}
            onClose={() => actions.setShowHistoryModal(false)}
          />
        )}

        {/* 高频词与口癖点检浮层 */}
        {showOveruseModal && activeChapter && (
          <OveruseWordsModal
            content={activeChapter.content || ''}
            chapterTitle={activeChapter.title}
            onHighlightWord={(word) => {
              actions.setShowFindReplace(true)
              actions.setFindText(word)
            }}
            onClose={() => actions.setShowOveruseModal(false)}
          />
        )}

        {/* 字数面板配置弹窗 */}
        {showWordCountPanelModal && (
          <WordCountPanelModal
            onClose={() => actions.setShowWordCountPanelModal(false)}
            bookTitle={currentProject?.name || '私密作品使用指南'}
            bookCover={currentProject?.cover}
            todayTarget={dailyGoalTarget}
            stats={sessionStats}
            config={widgetConfig}
            onConfigChange={setWidgetConfig}
            onPinAsWidget={() => setShowFloatingWidget(true)}
            onOpenGoalModal={() => setShowGoalModal(true)}
          />
        )}

        {/* 可自由拖动的小组件卡片 */}
        {showFloatingWidget && (
          <FloatingWordCountWidget
            stats={sessionStats}
            config={widgetConfig}
            bookTitle={currentProject?.name || '私密作品使用指南'}
            bookCover={currentProject?.cover}
            todayTarget={dailyGoalTarget}
            onOpenSettings={() => actions.setShowWordCountPanelModal(true)}
            onOpenGoalModal={() => setShowGoalModal(true)}
            onClose={() => setShowFloatingWidget(false)}
          />
        )}

        {/* 每日目标与写作提醒弹窗 */}
        {showGoalModal && (
          <DailyGoalModal
            onClose={() => setShowGoalModal(false)}
            currentGoal={dailyGoalTarget}
            onSave={(newGoal) => {
              setDailyGoalTarget(newGoal)
              void localStorageKeyValueStore.set(`inkpi-daily-goal-${projectId}`, String(newGoal))
            }}
            onDelete={() => {
              setDailyGoalTarget(4600)
            }}
          />
        )}

        {/* 写作背景与网格线设置弹窗 */}
        {showBackgroundModal && (
          <BackgroundModal
            onClose={() => actions.setShowBackgroundModal(false)}
            config={bgConfig}
            onChange={setBgConfig}
          />
        )}

        {/* 字体、字号、行高行宽排版综合设置弹窗 */}
        {showFontFormatModal && (
          <FontFormatModal
            onClose={() => actions.setShowFontFormatModal(false)}
            model={model}
            editor={editorRef.current}
          />
        )}

        {chapterContextMenu && <ChapterContextMenu model={model} />}
        {renamingChapter && <RenameChapterDialog model={model} />}
        {deletingChapter && <DeleteChapterDialog model={model} />}
        {volumeContextMenu && <VolumeContextMenu model={model} />}
        {renamingVolume && <RenameVolumeDialog model={model} />}
        {deletingVolume && <DeleteVolumeDialog model={model} />}
      </div>
    </DesktopPluginHostProvider>
  )
}

export default RichEditor
