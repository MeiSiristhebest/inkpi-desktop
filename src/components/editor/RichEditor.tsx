import { useEffect, useRef, useCallback, type FC } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'

import { GhostText, clearGhostText as hideGhostText } from '../../extensions/ghost-text'
import { QuoteHighlight } from '../../extensions/quote-highlight'
import { SmartQuotes } from '../../extensions/smart-quotes'
import { useChapterEditorModel } from './hooks/useChapterEditorModel'
import { SensitiveModal } from './modals/SensitiveModal'
import { LockModal } from './modals/LockModal'
import { HistoryModal } from './modals/HistoryModal'
import { OveruseWordsModal } from './modals/OveruseWordsModal'

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
    ],
    content: activeChapter?.content || '',
    editorProps: {
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
    onUpdate: () => actions.handleEditorUpdate(),
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
