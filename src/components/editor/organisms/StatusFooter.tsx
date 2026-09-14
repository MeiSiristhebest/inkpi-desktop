import React from 'react'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface StatusFooterProps {
  model: EditorModel
  /** Kept for the RichEditor API; typewriter is not a footer control. */
  isTypewriter?: boolean
  onTypewriterChange?: (value: boolean) => void
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
}

/** 底部状态栏：只呈现写作进度、连接和保存状态。 */
export const StatusFooter: React.FC<StatusFooterProps> = ({
  model,
  isConnected = false,
  isReconnecting = false,
  onReconnect,
}) => {
  const { chapterWords, wordTarget, totalWords, isSaved } = model
  const connectionLabel = isConnected ? '已连接' : isReconnecting ? '连接中…' : '离线'
  const connectionDescription = isConnected
    ? '已连接 InkPi Daemon，点击重连'
    : isReconnecting
      ? '正在连接 InkPi Daemon'
      : '离线，点击重连 InkPi Daemon'

  return (
    <footer
      data-testid="editor-status-footer"
      data-layout="single-row"
      aria-label="编辑状态"
      className="editor-status-footer h-8 min-h-8 max-h-8 flex-[0_0_2rem] min-w-0 flex flex-nowrap items-center justify-between gap-3 overflow-hidden px-4 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[11px] text-[var(--ink-text-faint)] whitespace-nowrap"
    >
      <div className="editor-status-primary min-w-0 flex flex-1 items-center gap-4 overflow-hidden">
        <span
          data-testid="editor-chapter-progress"
          data-status-kind="chapter-progress"
          className="tabular-nums"
          title="本章字数与每章目标"
          aria-label={`本章进度 ${chapterWords.toLocaleString()} / ${wordTarget.toLocaleString()} 字`}
        >
          本章 {chapterWords.toLocaleString()} / {wordTarget.toLocaleString()} 字
        </span>
        <span
          data-testid="editor-total-words"
          data-status-kind="book-progress"
          className="editor-total-words tabular-nums"
          title="当前作品所有章节合计"
          aria-label={`全书总字数 ${totalWords.toLocaleString()} 字`}
        >
          全书 {totalWords.toLocaleString()} 字
        </span>

        <button
          type="button"
          onClick={() => onReconnect?.()}
          disabled={isReconnecting}
          data-testid="editor-connection-status"
          data-status-kind="connection"
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

      <div className="editor-status-secondary min-w-0 flex shrink-0 items-center gap-3">
        <span
          data-testid="editor-status-save-state"
          data-status-kind="save"
          aria-label={isSaved ? '内容已保存' : '内容未保存'}
          className={`editor-status-save-state ${isSaved ? '' : 'text-[var(--ink-text-muted)]'}`}
          title={isSaved ? '已保存' : '未保存，按 ⌘S 保存'}
        >
          {isSaved ? '已保存' : '未保存'}
        </span>
      </div>
    </footer>
  )
}
