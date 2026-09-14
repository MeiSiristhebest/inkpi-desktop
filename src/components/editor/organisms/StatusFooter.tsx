import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, AlignJustify, Type, BarChart3 } from 'lucide-react'
import { spring, variants, gesture } from '../../../motion'
import { IconButton } from '../../../ui/atoms/IconButton'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface StatusFooterProps {
  model: EditorModel
  isTypewriter: boolean
  onTypewriterChange?: (v: boolean) => void
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
}

/** 底部状态栏。organisms 层，仅声明式渲染。 */
export const StatusFooter: React.FC<StatusFooterProps> = ({
  model,
  isTypewriter,
  onTypewriterChange,
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

  const updatedAtLabel = activeChapter?.updatedAt
    ? new Date(activeChapter.updatedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null
  const connectionLabel = isConnected ? '已连接' : isReconnecting ? '连接中…' : '离线'
  const connectionDescription = isConnected
    ? '已连接 InkPi Daemon，点击重连'
    : isReconnecting
      ? '正在连接 InkPi Daemon'
      : '离线，点击重连 InkPi Daemon'

  return (
    <footer
      data-testid="editor-status-footer"
      className="editor-status-footer h-8 shrink-0 flex flex-nowrap items-center justify-between gap-3 px-4 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[11px] text-[var(--ink-text-faint)] whitespace-nowrap overflow-x-auto overflow-y-hidden"
    >
      <div className="editor-status-primary min-w-max flex items-center gap-4 shrink-0">
        <span
          data-testid="editor-chapter-progress"
          className="tabular-nums"
          title="本章字数与每章目标"
        >
          本章 {chapterWords.toLocaleString()} / {wordTarget.toLocaleString()} 字
        </span>
        <span className="tabular-nums" title="当前作品所有章节合计">
          全书 {totalWords.toLocaleString()} 字
        </span>
        {sessionWordDelta > 0 && (
          <span className="tabular-nums text-[var(--ink-success)]">本次 +{sessionWordDelta}</span>
        )}

        {/* 连接状态只保留一个可见标签，完整语义放在无障碍名称中。 */}
        <button
          type="button"
          onClick={() => onReconnect?.()}
          disabled={isReconnecting}
          aria-label={connectionDescription}
          title="重连 InkPi Daemon"
          className="flex items-center gap-1.5 hover:text-[var(--ink-text)] transition-colors cursor-pointer disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isConnected
                ? 'bg-[var(--ink-success)]'
                : isReconnecting
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-[var(--ink-text-faint)]'
            }`}
          />
          <span className="tabular-nums">{connectionLabel}</span>
        </button>
      </div>

      <div className="editor-status-secondary min-w-max flex items-center gap-3 shrink-0">
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

        {/* 字数详情入口：主指标只显示一次，详情使用单一图标入口。 */}
        <div className="relative" ref={wordMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setWordMenuOpen((v) => !v)
            }}
            aria-label="字数详情与稿费预估"
            aria-expanded={wordMenuOpen}
            aria-haspopup="menu"
            title="字数详情与稿费预估"
            className="editor-status-word-details p-1 rounded-md hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer select-none"
          >
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {/* 向上弹出菜单 */}
          <AnimatePresence>
            {wordMenuOpen && (
              <motion.div
                {...variants.scaleIn}
                transition={spring.snappy}
                className="absolute bottom-full right-0 mb-1.5 z-50 min-w-[120px] py-1 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[13px] overflow-hidden"
              >
                <motion.button
                  type="button"
                  {...gesture.listRow}
                  transition={spring.snappy}
                  onClick={() => {
                    actions.setShowWordCountPanelModal(true)
                    setWordMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>字数详情</span>
                </motion.button>
                <motion.button
                  type="button"
                  {...gesture.listRow}
                  transition={spring.snappy}
                  onClick={() => {
                    // 稿费预估功能占位
                    setWordMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                >
                  <span className="text-amber-500 shrink-0 text-[15px] leading-none">¥</span>
                  <span>稿费预估</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
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

        <span
          className={`editor-status-save-state ${isSaved ? '' : 'text-[var(--ink-text-muted)]'}`}
          title={
            updatedAtLabel
              ? `${isSaved ? '已保存' : '未保存'} · 最后更新 ${updatedAtLabel}`
              : '⌘S 保存'
          }
        >
          {isSaved ? '已保存' : '未保存'}
        </span>
      </div>
    </footer>
  )
}
