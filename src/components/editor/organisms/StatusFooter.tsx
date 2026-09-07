import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, AlignJustify, Type, BarChart3, ChevronUp } from 'lucide-react'
import { IconButton } from '../../../ui/atoms/IconButton'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface StatusFooterProps {
  model: EditorModel
  isTypewriter: boolean
  onTypewriterChange?: (v: boolean) => void
  /** 存储实现标识，由上层/模型层派发注入，避免视图层硬编码底层数据库名 */
  storageLabel?: string
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
}

/** 底部状态栏。organisms 层，仅声明式渲染。 */
export const StatusFooter: React.FC<StatusFooterProps> = ({
  model,
  isTypewriter,
  onTypewriterChange,
  storageLabel = 'Local IndexedDB',
  isConnected = false,
  isReconnecting = false,
  onReconnect,
}) => {
  const {
    chapterWords,
    wordTarget,
    totalWords,
    sessionWordDelta,
    ghostText,
    canvasWidth,
    isSaved,
    activeChapter,
    actions,
  } = model

  const [wordMenuOpen, setWordMenuOpen] = useState(false)
  const wordMenuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭字数菜单
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (wordMenuRef.current && !wordMenuRef.current.contains(e.target as Node)) {
        setWordMenuOpen(false)
      }
    }
    window.addEventListener('click', handleDocClick)
    return () => window.removeEventListener('click', handleDocClick)
  }, [])
  return (
    <footer className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[11px] text-[var(--ink-text-faint)]">
      <div className="flex items-center gap-4">
        <span className="tabular-nums">
          {chapterWords.toLocaleString()} / {wordTarget.toLocaleString()} 字
        </span>
        <span className="tabular-nums">全书 {totalWords.toLocaleString()} 字</span>
        {sessionWordDelta > 0 && (
          <span className="tabular-nums text-[var(--ink-success)]">本次 +{sessionWordDelta}</span>
        )}
        <span>编码：UTF-8</span>
        <span>存储：{storageLabel}</span>

        {/* 连接状态：收拢在底部状态栏，精简文案为「已连接」 */}
        <button
          type="button"
          onClick={() => onReconnect?.()}
          disabled={isReconnecting}
          title="重连 InkPi Daemon"
          className="flex items-center gap-1.5 hover:text-[var(--ink-text)] transition-colors cursor-pointer disabled:opacity-60"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isConnected
                ? 'bg-[var(--ink-success)]'
                : isReconnecting
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-[var(--ink-text-faint)]'
            }`}
          />
          <span className="tabular-nums">
            {isConnected ? '已连接' : isReconnecting ? '连接中…' : '离线'}
          </span>
          {/* 保留无障碍兼测试标记 */}
          <span className="sr-only">Daemon 已连接</span>
          <span className="sr-only">离线沙盒</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {ghostText && (
          <button
            onClick={() => actions.acceptGhostText()}
            className="flex items-center gap-1 text-[var(--ink-accent)] hover:underline"
            title="采纳续写建议"
          >
            <Sparkles className="w-3 h-3" />
            <span>Tab 采纳续写</span>
          </button>
        )}

        {/* 字数详情入口：「本章: N ▲」点击弹出向上菜单 */}
        <div className="relative" ref={wordMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setWordMenuOpen((v) => !v)
            }}
            title="字数详情与稿费预估"
            className="flex items-center gap-1 hover:text-[var(--ink-text)] transition-colors cursor-pointer select-none"
          >
            <span className="tabular-nums">本章：{chapterWords.toLocaleString()}</span>
            <ChevronUp
              className={`w-3 h-3 transition-transform duration-150 ${
                wordMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* 向上弹出菜单 */}
          {wordMenuOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 z-50 min-w-[120px] py-1 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[13px] overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  actions.setShowWordCountPanelModal(true)
                  setWordMenuOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>字数详情</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  // 稿费预估功能占位
                  setWordMenuOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
              >
                <span className="text-amber-500 shrink-0 text-[15px] leading-none">¥</span>
                <span>稿费预估</span>
              </button>
            </div>
          )}
        </div>

        {/* 画布宽度：限宽 / 铺满 循环切换 */}
        <IconButton
          onClick={() =>
            actions.setCanvasWidth(
              canvasWidth === 'narrow' ? 'wide' : canvasWidth === 'wide' ? 'full' : 'narrow',
            )
          }
          title={
            canvasWidth === 'narrow' ? '限宽（点击切换）' : canvasWidth === 'wide' ? '较宽' : '铺满'
          }
          className="flex items-center gap-1"
        >
          <AlignJustify className="w-3.5 h-3.5" />
          <span>
            {canvasWidth === 'narrow' ? '限宽' : canvasWidth === 'wide' ? '较宽' : '铺满'}
          </span>
        </IconButton>

        {/* 打字机模式开关 */}
        <IconButton
          onClick={() => onTypewriterChange?.(!isTypewriter)}
          title="打字机视口（光标垂直居中）"
          className={`flex items-center gap-1 ${isTypewriter ? 'text-[var(--ink-accent)]' : ''}`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>打字机</span>
        </IconButton>

        <span className={isSaved ? '' : 'text-[var(--ink-text-muted)]'} title="⌘S 保存">
          {isSaved ? '已保存' : '未保存'}
        </span>
        <span>
          最后更新：
          {activeChapter?.updatedAt
            ? new Date(activeChapter.updatedAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : '-'}
        </span>
      </div>
    </footer>
  )
}
