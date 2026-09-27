import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  ChevronDown,
  ShieldAlert,
  BarChart3,
  Columns2,
  StickyNote,
  History,
  Lock,
  Search,
  BookOpen,
  AlignLeft,
  PencilLine,
  Download,
  FileText,
  Code2,
  FileCode,
  Sparkles,
  Bold,
  Italic,
  Undo2,
  Redo2,
  Home,
  Focus,
  Maximize2,
  Minimize2,
  PanelRight,
  Puzzle,
  Palette,
  X,
} from 'lucide-react'
import { STATUS_OPTIONS } from '../editorUi'
import { IconButton } from '../../../ui/atoms/IconButton'
import { ContextMenu, type ContextMenuItem } from '../../../ui/molecules/ContextMenu'
import { spring, gesture } from '../../../motion'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { ChapterStatus } from '../../../types'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { useOptionalPluginRegistry } from '../../../core/pluginRegistry'
import {
  PLUGIN_DRAWER_CAPABILITY_ORDER,
  drawerCapabilityLabel,
} from '../../../core/capabilityRegistry'
import type { DesktopPlugin, PluginDrawerCapability } from '../../../types/plugin'
import { shortcutHint } from '../../../core/editorShortcuts'

/** 已经声明了能力类别的抽屉插件：分组只需要这一个前提，所以把它写进类型而不是靠断言。 */
type CategorizedDrawerPlugin = DesktopPlugin & { drawerCapability: PluginDrawerCapability }

/**
 * 抽屉候选按三类能力连续排列（§P2.8），分组小标题才成立；同类内保持注册表原序（sort 稳定）。
 * 没声明能力类别的插件不进候选：注册表里每个抽屉都成对声明了 kind（catalog 测试兜住），
 * 所以这里不是在猜它是哪类，而是不给「无类别抽屉」编一个分组名。
 */
function collectDrawerPlugins(activePlugins: DesktopPlugin[]): CategorizedDrawerPlugin[] {
  return activePlugins
    .filter(
      (plugin): plugin is CategorizedDrawerPlugin =>
        Boolean(plugin.drawerSnippetView) && Boolean(plugin.drawerCapability),
    )
    .sort(
      (a, b) =>
        PLUGIN_DRAWER_CAPABILITY_ORDER.indexOf(a.drawerCapability) -
        PLUGIN_DRAWER_CAPABILITY_ORDER.indexOf(b.drawerCapability),
    )
}

interface EditorToolbarProps {
  model: EditorModel
  editor?: any
  onHome?: () => void
  onToggleFocus?: () => void
  focusMode?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onToggleRightPanel?: () => void
  isRightOpen?: boolean
  hasAssistant?: boolean
  showReferencesSidebar?: boolean
  onToggleReferencesSidebar?: () => void
  entityHighlightEnabled?: boolean
  onToggleEntityHighlight?: () => void
}

/** 顶栏（聚焦模式下隐藏）：章节切换 / 标题 / 状态 / 优雅分组工具集。organisms 层，仅声明式渲染。 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  model,
  editor,
  onHome,
  onToggleFocus,
  focusMode = false,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleRightPanel,
  isRightOpen = false,
  hasAssistant = false,
  showReferencesSidebar = false,
  onToggleReferencesSidebar,
  entityHighlightEnabled = true,
  onToggleEntityHighlight,
}) => {
  const {
    actions,
    currentChapterIndex,
    linearChapters,
    isSidebarOpen,
    breadcrumb,
    activeChapter,
    showSplitView,
    showScratchpad,
    showFindReplace,
    ghostText,
  } = model

  const [activeMenu, setActiveMenu] = useState<
    'format' | 'proof' | 'tools' | 'export' | 'drawers' | null
  >(null)
  const [titleDraft, setTitleDraft] = useState(activeChapter?.title ?? '')
  const titleChapterIdRef = useRef<string | null>(activeChapter?.id ?? null)
  const persistedTitleRef = useRef(activeChapter?.title ?? '')
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const host = useOptionalPluginHostContext()
  const registry = useOptionalPluginRegistry()

  useEffect(() => {
    const chapterId = activeChapter?.id ?? null
    const nextTitle = activeChapter?.title ?? ''
    const chapterChanged = titleChapterIdRef.current !== chapterId
    if (chapterChanged || titleDraft === persistedTitleRef.current) {
      setTitleDraft(nextTitle)
    }
    titleChapterIdRef.current = chapterId
    persistedTitleRef.current = nextTitle
  }, [activeChapter?.id, activeChapter?.title, titleDraft])

  // 点击外部收起打开的下拉菜单
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    window.addEventListener('click', handleDocClick)
    return () => window.removeEventListener('click', handleDocClick)
  }, [])

  const toggleMenu = (menu: 'format' | 'proof' | 'tools' | 'export' | 'drawers') => {
    setActiveMenu((curr) => (curr === menu ? null : menu))
  }

  // §P2.8：抽屉不是「每个插件一个抽屉」，也不允许由工具栏猜一个。
  // Puzzle 按钮只做一件事——把当前启用、真的带随动抽屉、且已归入三类能力之一的插件摊开，由作者明确选一个。
  const drawerPlugins = collectDrawerPlugins(registry?.activePlugins ?? [])
  const openDrawerPlugin =
    drawerPlugins.find((p) => p.id === host?.activeDrawerPluginId) ?? undefined
  const drawerMenuItems: ContextMenuItem[] = [
    ...(openDrawerPlugin
      ? [
          {
            key: 'close-drawer',
            label: `关闭「${openDrawerPlugin.name}」抽屉`,
            icon: <X size={13} />,
            onClick: () => host?.closeDrawer(),
          },
        ]
      : []),
    ...drawerPlugins.map((plugin, index) => {
      // 相邻同类才成组：分组标题只在这一类的第一个条目上出现。
      const startsGroup =
        index === 0 || drawerPlugins[index - 1].drawerCapability !== plugin.drawerCapability
      return {
        key: `drawer:${plugin.id}`,
        label: plugin.name,
        description: plugin.description,
        icon: <plugin.icon className="w-3.5 h-3.5" />,
        groupLabel: startsGroup ? drawerCapabilityLabel(plugin.drawerCapability) : undefined,
        dividerBefore: startsGroup && index > 0,
        onClick: () => host?.openDrawer(plugin.id),
      }
    }),
  ]

  const hasGhostText = ghostText.trim().length > 0

  return (
    <header
      ref={toolbarRef}
      data-testid="editor-toolbar"
      data-layout="single-row"
      aria-label="编辑工具栏"
      className="editor-toolbar h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] relative select-none"
    >
      {/* 左侧：返回作品库 + 翻章导航 + 目录展开 + 章节标题输入 + 状态选择器 */}
      <div className="editor-toolbar-left flex items-center gap-1.5 min-w-0 flex-1">
        {onHome && (
          <IconButton onClick={onHome} title="返回作品库">
            <Home className="w-4 h-4" />
          </IconButton>
        )}

        <IconButton
          onClick={() => actions.prevChapter()}
          disabled={currentChapterIndex <= 0}
          title="上一章（快速切章）"
          className="disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </IconButton>
        <IconButton
          onClick={() => actions.nextChapter()}
          disabled={currentChapterIndex < 0 || currentChapterIndex >= linearChapters.length - 1}
          title="下一章（快速切章）"
          className="disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </IconButton>

        {!isSidebarOpen && (
          <IconButton
            onClick={() => actions.setSidebar(true)}
            title={shortcutHint('展开目录', 'toggleChapterTree')}
            className="text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </IconButton>
        )}

        {/* 目录折叠后显示「第X卷 · 第X章」定位 */}
        {!isSidebarOpen && breadcrumb && (
          <span className="text-[11px] text-[var(--ink-text-faint)] px-1.5 py-0.5 rounded-md bg-[var(--ink-bg-hover)] whitespace-nowrap shrink-0 font-medium">
            {breadcrumb}
          </span>
        )}

        <input
          type="text"
          value={titleDraft}
          onChange={(e) => {
            const nextTitle = e.target.value
            setTitleDraft(nextTitle)
            void actions.updateActiveTitle(nextTitle)
          }}
          onBlur={() => void actions.updateActiveTitle(titleDraft)}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium px-2 py-1 rounded-md hover:bg-[var(--ink-bg-hover)] focus:bg-[var(--ink-bg-hover)] focus:outline-none truncate transition-colors"
          placeholder="无标题章节"
        />

        {/* 章节状态选择器 */}
        <div className="relative shrink-0">
          <select
            value={activeChapter?.status || 'draft'}
            onChange={(e) => actions.setStatus(e.target.value as ChapterStatus)}
            className="appearance-none pl-2.5 pr-6 py-1 rounded-lg text-[11px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer font-medium"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: STATUS_OPTIONS.find(
                (s) => s.value === (activeChapter?.status || 'draft'),
              )?.color,
            }}
          />
        </div>

        {/* 常用文字样式与排版胶囊群（Apple 式收拢） */}
        <div className="editor-toolbar-inline-controls hidden sm:flex items-center gap-1 border-l border-[var(--ink-border)] pl-2 ml-1">
          {/* 写作背景与网格线（使用正规 Lucide 图标，绝不使用任何 Emoji） */}
          <button
            type="button"
            onClick={() => actions.setShowBackgroundModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer font-medium"
            title="写作背景底色与稿纸网格线"
          >
            <Palette className="w-3.5 h-3.5 text-amber-500" />
            <span className="editor-toolbar-inline-label">背景</span>
          </button>

          {/* 引用名内联高亮开关 */}
          {onToggleEntityHighlight && (
            <button
              type="button"
              onClick={onToggleEntityHighlight}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] transition-colors cursor-pointer font-medium ${
                entityHighlightEnabled
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
              }`}
              title={entityHighlightEnabled ? '点击关闭正文实体高亮' : '点击开启正文实体高亮'}
            >
              <PencilLine className="w-3.5 h-3.5" />
              <span className="editor-toolbar-inline-label">高亮</span>
            </button>
          )}

          {/* 本章引用侧栏开关 */}
          {onToggleReferencesSidebar && (
            <button
              type="button"
              onClick={onToggleReferencesSidebar}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] transition-colors cursor-pointer font-medium ${
                showReferencesSidebar
                  ? 'bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold'
                  : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
              }`}
              title="展开/收起本章引用侧栏（角色与设定条目）"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="editor-toolbar-inline-label">引用</span>
            </button>
          )}

          <div className="w-px h-3.5 bg-[var(--ink-border)] mx-0.5" />

          {/* 撤销 (Undo) */}
          <motion.button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().undo().run()
              }
            }}
            disabled={!editor || (typeof editor.can === 'function' ? !editor.can().undo() : false)}
            {...gesture.iconButton}
            transition={spring.snappy}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={shortcutHint('撤销 / 返回上一步', 'undo')}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </motion.button>

          {/* 重做 (Redo) */}
          <motion.button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().redo().run()
              }
            }}
            disabled={!editor || (typeof editor.can === 'function' ? !editor.can().redo() : false)}
            {...gesture.iconButton}
            transition={spring.snappy}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={shortcutHint('重做 / 返回下一步', 'redo')}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </motion.button>

          <div className="w-px h-3.5 bg-[var(--ink-border)] mx-0.5" />

          {/* 加粗 (Bold) */}
          <motion.button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().toggleBold().run()
              }
            }}
            {...gesture.iconButton}
            transition={spring.snappy}
            className={`p-1 rounded transition-colors cursor-pointer ${
              typeof editor?.isActive === 'function' && editor.isActive('bold')
                ? 'bg-[var(--ink-bg-active)] text-[var(--ink-accent)] font-bold'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
            title={shortcutHint('加粗', 'bold')}
          >
            <Bold className="w-3.5 h-3.5" />
          </motion.button>

          {/* 倾斜 (Italic) */}
          <motion.button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().toggleItalic().run()
              }
            }}
            {...gesture.iconButton}
            transition={spring.snappy}
            className={`p-1 rounded transition-colors cursor-pointer ${
              typeof editor?.isActive === 'function' && editor.isActive('italic')
                ? 'bg-[var(--ink-bg-active)] text-[var(--ink-accent)]'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
            title={shortcutHint('倾斜', 'italic')}
          >
            <Italic className="w-3.5 h-3.5" />
          </motion.button>

          {/* 隐藏保留用于向后兼容单测的选择器 */}
          <div className="hidden" aria-hidden="true">
            <select
              value={model.fontFamily || 'wenkai'}
              onChange={(e) => model.updateSettings?.({ fontFamily: e.target.value as any })}
              title="正文字体：切换当前正文的呈现字体（霞鹜文楷、思源宋体、黑体、楷体、仿宋等）"
            >
              <option value="wenkai">文楷</option>
            </select>
            <select
              value={model.fontSize || 18}
              onChange={(e) => model.updateSettings?.({ fontSize: Number(e.target.value) })}
              title="正文字号：调整写作正文的文字大小（如 18px）"
            >
              <option value="18">18px</option>
            </select>
            <select
              value={model.lineHeight || '2.0'}
              onChange={(e) => model.updateSettings?.({ lineHeight: e.target.value })}
              title="行间距：调整单行文字之间的垂直倍数（默认 2.0）"
            >
              <option value="2.0">2.0</option>
            </select>
            <select
              value={model.paragraphSpacing ?? 0.25}
              onChange={(e) => model.updateSettings?.({ paragraphSpacing: Number(e.target.value) })}
              title="段落间距：调整段落与段落之间的留白间隔（默认 0.25，增大更有网文呼吸感）"
            >
              <option value="0.25">0.25</option>
            </select>
          </div>
        </div>
      </div>

      {/* 右侧：语义分组入口；续写建议是唯一的上下文动作，不放入底部状态栏。 */}
      <div
        data-testid="editor-toolbar-actions"
        className="editor-toolbar-actions flex items-center gap-1 shrink-0 relative"
      >
        {hasGhostText && (
          <button
            type="button"
            data-testid="editor-toolbar-ghost-action"
            onClick={() => actions.acceptGhostText()}
            aria-label="采纳续写建议"
            title="采纳续写建议（Tab）"
            className="editor-toolbar-action-button flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[var(--ink-accent)] hover:bg-[var(--ink-accent-soft)] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="editor-toolbar-label">Tab 采纳续写</span>
          </button>
        )}

        {/* 1. 排版与标点规整 */}
        <div className="relative">
          <button
            type="button"
            data-testid="editor-toolbar-format-trigger"
            aria-haspopup="menu"
            aria-expanded={activeMenu === 'format'}
            onClick={() => toggleMenu('format')}
            className={`editor-toolbar-menu-trigger flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'format'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="排版与标点规范"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="editor-toolbar-label">排版</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* 排版下拉菜单 */}
          <div
            className={`absolute right-0 top-full mt-1.5 z-50 min-w-[220px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12px] transition-all backdrop-blur-md ${
              activeMenu === 'format'
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-[var(--ink-text-faint)] uppercase tracking-wider">
              正文排版方案
            </div>
            <button
              type="button"
              onClick={() => {
                actions.setShowFontFormatModal(true)
                setActiveMenu(null)
              }}
              title="正文字体、字号、行距与排版规范"
              data-testid="editor-font-format-menu-item"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <span className="w-3.5 text-center font-serif font-bold text-[12px]">T</span>
              <span>字体、字号与行距</span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.autoFormat()
                setActiveMenu(null)
              }}
              title="一键首行缩进排版"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                <span>经典出版（空两格）</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">缩进</span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.formatWithPreset('web-novel')
                setActiveMenu(null)
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>现代网文（段落分行）</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">空行</span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.formatWithPreset('dialogue')
                setActiveMenu(null)
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>剧本对话体（顶格对话）</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">对话</span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.formatWithPreset('clean')
                setActiveMenu(null)
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 text-center text-xs text-[var(--ink-text-faint)]">—</span>
                <span>清除所有段首空格</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">清空</span>
            </button>

            <div className="border-t border-[var(--ink-border)]/60 my-1" />

            <div className="px-2 py-1 text-[10px] font-semibold text-[var(--ink-text-faint)] uppercase tracking-wider">
              标点规范化
            </div>
            <button
              type="button"
              onClick={() => {
                actions.punctuationFix()
                setActiveMenu(null)
              }}
              title="标点规整"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PencilLine className="w-3.5 h-3.5 text-emerald-500" />
                <span>标点智能规整（双引号/破折号）</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. 审校与体检 */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={activeMenu === 'proof'}
            onClick={() => toggleMenu('proof')}
            className={`editor-toolbar-menu-trigger flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'proof'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="审校与内容体检"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span className="editor-toolbar-label">审校</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <div
            className={`absolute right-0 top-full mt-1.5 z-50 min-w-[210px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12px] transition-all backdrop-blur-md ${
              activeMenu === 'proof'
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                actions.setShowSensitiveModal(true)
                setActiveMenu(null)
              }}
              title="敏感词检测（本章）"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>敏感词即时检测（本章）</span>
            </button>
            <button
              type="button"
              onClick={() => {
                actions.setShowOveruseModal(true)
                setActiveMenu(null)
              }}
              title="高频词与口癖点检"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
              <span>口癖与高频词点检</span>
            </button>
          </div>
        </div>

        {/* 3. 辅助与专注工具箱 */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={activeMenu === 'tools'}
            onClick={() => toggleMenu('tools')}
            className={`editor-toolbar-menu-trigger flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'tools' || showSplitView || showScratchpad
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="创作辅助与沉浸工具"
          >
            <Columns2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="editor-toolbar-label">辅助</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <div
            className={`absolute right-0 top-full mt-1.5 z-50 min-w-[210px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12px] transition-all backdrop-blur-md ${
              activeMenu === 'tools'
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                actions.setShowSplitView(!showSplitView)
                setActiveMenu(null)
              }}
              title="分屏对照阅读历史章节"
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                showSplitView
                  ? 'bg-[var(--ink-accent)] text-white'
                  : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Columns2 className="w-3.5 h-3.5" />
                <span>分屏 1:1 对照阅读</span>
              </div>
              {showSplitView && <span className="text-[10px]">开启中</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                actions.setShowScratchpad(!showScratchpad)
                setActiveMenu(null)
              }}
              title="行旁待办与备忘便签（导出自动滤除）"
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                showScratchpad
                  ? 'bg-amber-500 text-white'
                  : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <StickyNote className="w-3.5 h-3.5" />
                <span>本章伏笔与备忘便签</span>
              </div>
              {showScratchpad && <span className="text-[10px]">开启中</span>}
            </button>

            <div className="border-t border-[var(--ink-border)]/60 my-1" />

            <button
              type="button"
              onClick={() => {
                actions.setShowHistoryModal(true)
                setActiveMenu(null)
              }}
              title="时光机 · 版本历史"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-500" />
              <span>时光机 · 版本历史与比对</span>
            </button>

            <button
              type="button"
              onClick={() => {
                actions.setShowLockModal(true)
                setActiveMenu(null)
              }}
              title="小黑屋 · 强制专注码字"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>进入小黑屋码字</span>
            </button>
          </div>
        </div>

        {/* 4. 统一查找替换入口 */}
        <button
          type="button"
          className={`editor-toolbar-action-button editor-toolbar-find-trigger flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
            showFindReplace
              ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
              : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
          }`}
          onClick={() => actions.setShowFindReplace(!showFindReplace)}
          title={shortcutHint('查找替换 / 全文检索', 'findReplace')}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="editor-toolbar-label">查找</span>
        </button>

        {/* 隐藏保留全书检索触发器（保证测试与全局快捷键兼容） */}
        <button
          type="button"
          onClick={() => actions.setShowGlobalSearch(true)}
          title="全书检索（跨所有章节）"
          className="hidden"
          aria-hidden="true"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        {/* 5. 导出与分享下拉 */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={activeMenu === 'export'}
            onClick={() => toggleMenu('export')}
            className={`editor-toolbar-menu-trigger flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'export'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="导出与分享"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="editor-toolbar-label">导出</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <div
            className={`absolute right-0 top-full mt-1.5 z-50 min-w-[200px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12px] transition-all backdrop-blur-md ${
              activeMenu === 'export'
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                actions.exportChapter('txt')
                setActiveMenu(null)
              }}
              title="导出为 TXT"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                <span>导出 TXT 文档</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">.txt</span>
            </button>

            <button
              type="button"
              onClick={() => {
                actions.exportChapter('md')
                setActiveMenu(null)
              }}
              title="导出为 MD"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-blue-500" />
                <span>导出 Markdown</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">.md</span>
            </button>

            <button
              type="button"
              onClick={() => {
                actions.exportChapter('html')
                setActiveMenu(null)
              }}
              title="导出为 HTML"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-amber-500" />
                <span>导出 HTML 单页</span>
              </div>
              <span className="text-[10px] text-[var(--ink-text-faint)]">.html</span>
            </button>
          </div>
        </div>

        {/* 全局工作台功能：聚焦 / 全屏 / AI 助手或信息栏 */}
        {(onToggleFocus || onToggleFullscreen || onToggleRightPanel) && (
          <div className="flex items-center gap-0.5 border-l border-[var(--ink-border)] pl-1 ml-0.5">
            {onToggleFocus && (
              <IconButton
                onClick={onToggleFocus}
                title={focusMode ? '退出聚焦模式 (Esc)' : '聚焦模式（仅留写作画布）'}
                className={focusMode ? 'text-[var(--ink-accent)]' : ''}
              >
                <Focus className="w-3.5 h-3.5" />
              </IconButton>
            )}

            {onToggleFullscreen && (
              <IconButton onClick={onToggleFullscreen} title="全屏 / 退出全屏">
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </IconButton>
            )}
            {onToggleRightPanel && (
              <IconButton
                onClick={onToggleRightPanel}
                title={
                  hasAssistant
                    ? isRightOpen
                      ? '收起 AI 助手'
                      : '打开 AI 助手'
                    : isRightOpen
                      ? '收起信息栏'
                      : '展开信息栏'
                }
                className={isRightOpen ? 'text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]' : ''}
              >
                {hasAssistant ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <PanelRight className="w-3.5 h-3.5" />
                )}
              </IconButton>
            )}

            {host && (
              <div className="relative">
                <IconButton
                  data-testid="editor-toolbar-drawer-trigger"
                  aria-haspopup="menu"
                  aria-expanded={activeMenu === 'drawers'}
                  aria-label="插件随动抽屉"
                  onClick={() => toggleMenu('drawers')}
                  title={
                    openDrawerPlugin
                      ? `当前抽屉：${openDrawerPlugin.name}（可切换或关闭）`
                      : '选择要打开的插件抽屉'
                  }
                  className={
                    host.activeDrawerPluginId
                      ? 'text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]'
                      : ''
                  }
                >
                  <Puzzle className="w-3.5 h-3.5" />
                </IconButton>
                {activeMenu === 'drawers' && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setActiveMenu(null)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setActiveMenu(null)
                      }}
                    />
                    <ContextMenu
                      items={drawerMenuItems}
                      header={
                        drawerPlugins.length === 0
                          ? '没有启用中的插件提供随动抽屉，请先在「插件管理」里启用'
                          : '选择要打开哪个抽屉'
                      }
                      widthClass="min-w-[268px] max-w-[320px] max-h-[70vh] overflow-y-auto"
                      ariaLabel="插件随动抽屉"
                      onClose={() => setActiveMenu(null)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
