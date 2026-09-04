import React, { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { STATUS_OPTIONS } from '../editorUi'
import { IconButton } from '../../../ui/atoms/IconButton'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { ChapterStatus } from '../../../types'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { useOptionalPluginRegistry } from '../../../core/pluginRegistry'

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
  isNavOpen?: boolean
  onToggleNav?: () => void
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
  isNavOpen = true,
  onToggleNav,
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
  } = model

  const [activeMenu, setActiveMenu] = useState<'format' | 'proof' | 'tools' | 'export' | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const host = useOptionalPluginHostContext()
  const registry = useOptionalPluginRegistry()

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

  const toggleMenu = (menu: 'format' | 'proof' | 'tools' | 'export') => {
    setActiveMenu((curr) => (curr === menu ? null : menu))
  }

  return (
    <header
      ref={toolbarRef}
      className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] relative select-none"
    >
      {/* 左侧：返回作品库 + 导航展开 + 翻章导航 + 目录展开 + 章节标题输入 + 状态选择器 */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {onToggleNav && !isNavOpen && (
          <IconButton onClick={onToggleNav} title="展开导航">
            <PanelLeftOpen className="w-4 h-4" />
          </IconButton>
        )}
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
            title="展开目录 (⌘B)"
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
          value={activeChapter?.title || ''}
          onChange={(e) => actions.updateActiveTitle(e.target.value)}
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

        {/* 常用文字样式与撤销重做工具组 */}
        <div className="hidden sm:flex items-center gap-1 border-l border-[var(--ink-border)] pl-2 ml-1">
          {/* 字体族直接选择下拉 */}
          <select
            value={model.fontFamily || 'wenkai'}
            onChange={(e) => model.updateSettings?.({ fontFamily: e.target.value as any })}
            title="正文字体：切换当前正文的呈现字体（霞鹜文楷、思源宋体、黑体、楷体、仿宋等）"
            className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer text-[var(--ink-text)] font-medium"
          >
            <option value="wenkai">文楷</option>
            <option value="serif">宋体</option>
            <option value="sans">黑体</option>
            <option value="kaiti">楷体</option>
            <option value="fangsong">仿宋</option>
            <option value="mono">等宽</option>
          </select>

          {/* 正文字号数字选择器 */}
          <select
            value={model.fontSize || 18}
            onChange={(e) => model.updateSettings?.({ fontSize: Number(e.target.value) })}
            title="正文字号：调整写作正文的文字大小（如 18px）"
            className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer text-[var(--ink-text)] font-medium"
          >
            {[14, 15, 16, 17, 18, 20, 22, 24, 28].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>

          {/* 正文行距选择器（纯净纯数字，悬浮提示） */}
          <select
            value={model.lineHeight || '2.0'}
            onChange={(e) => model.updateSettings?.({ lineHeight: e.target.value })}
            title="行间距：调整单行文字之间的垂直倍数（默认 2.0）"
            className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer text-[var(--ink-text)] font-medium"
          >
            {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '2.2', '2.4', '2.8'].map((lh) => (
              <option key={lh} value={lh}>
                {lh}
              </option>
            ))}
          </select>

          {/* 段落间距选择器（纯净纯数字，悬浮提示） */}
          <select
            value={model.paragraphSpacing ?? 0.25}
            onChange={(e) => model.updateSettings?.({ paragraphSpacing: Number(e.target.value) })}
            title="段落间距：调整段落与段落之间的留白间隔（默认 0.25，增大更有网文呼吸感）"
            className="appearance-none px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer text-[var(--ink-text)] font-medium"
          >
            {[0, 0.25, 0.5, 0.75, 1.0].map((ps) => (
              <option key={ps} value={ps}>
                {ps.toFixed(2)}
              </option>
            ))}
          </select>

          <div className="w-px h-3.5 bg-[var(--ink-border)] mx-0.5" />

          {/* 撤销 (Undo) */}
          <button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().undo().run()
              }
            }}
            disabled={!editor || (typeof editor.can === 'function' ? !editor.can().undo() : false)}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="撤销 / 返回上一步 (⌘Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* 重做 (Redo) */}
          <button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().redo().run()
              }
            }}
            disabled={!editor || (typeof editor.can === 'function' ? !editor.can().redo() : false)}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="重做 / 返回下一步 (⇧⌘Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-[var(--ink-border)] mx-0.5" />

          {/* 加粗 (Bold) */}
          <button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().toggleBold().run()
              }
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              typeof editor?.isActive === 'function' && editor.isActive('bold')
                ? 'bg-[var(--ink-bg-active)] text-[var(--ink-accent)] font-bold'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
            title="加粗 (⌘B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* 倾斜 (Italic) */}
          <button
            type="button"
            onClick={() => {
              if (editor && !editor.isDestroyed && editor.chain) {
                editor.chain().focus().toggleItalic().run()
              }
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              typeof editor?.isActive === 'function' && editor.isActive('italic')
                ? 'bg-[var(--ink-bg-active)] text-[var(--ink-accent)]'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
            }`}
            title="倾斜 (⌘I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 右侧：5 个语义清晰的高阶分组下拉按钮，不再散落 14 个杂乱图标 */}
      <div className="flex items-center gap-1 shrink-0 relative">
        {/* 1. 排版与标点规整 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('format')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'format'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="排版与标点规范"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>排版</span>
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
            onClick={() => toggleMenu('proof')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'proof'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="审校与内容体检"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>审校</span>
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
            onClick={() => toggleMenu('tools')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'tools' || showSplitView || showScratchpad
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="创作辅助与沉浸工具"
          >
            <Columns2 className="w-3.5 h-3.5 text-blue-500" />
            <span>辅助</span>
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
          onClick={() => actions.setShowFindReplace(!showFindReplace)}
          title="查找替换 / 全文检索 (⌘F)"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
            showFindReplace
              ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
              : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>查找</span>
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
            onClick={() => toggleMenu('export')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-transparent transition-colors cursor-pointer ${
              activeMenu === 'export'
                ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)] border-[var(--ink-border)]'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
            }`}
            title="导出与分享"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出</span>
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
                  onClick={() => {
                    if (host.activeDrawerPluginId) {
                      host.closeDrawer()
                    } else {
                      // 默认打开活体世界书或第一个具备抽屉的插件
                      const firstDrawer = registry?.allPlugins.find((p) =>
                        Boolean(p.drawerSnippetView),
                      )
                      if (firstDrawer) host.openDrawer(firstDrawer.id)
                    }
                  }}
                  title={
                    host.activeDrawerPluginId
                      ? `关闭插件抽屉 (${host.activeDrawerPluginId})`
                      : '打开随动插件抽屉'
                  }
                  className={
                    host.activeDrawerPluginId
                      ? 'text-[var(--ink-accent)] bg-[var(--ink-bg-hover)]'
                      : ''
                  }
                >
                  <Puzzle className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
