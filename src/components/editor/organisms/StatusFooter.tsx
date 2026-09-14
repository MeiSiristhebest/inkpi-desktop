import React from 'react'
import { Sparkles } from 'lucide-react'
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

/** 底部状态栏：只呈现写作状态，不承载可从工具栏获得的编辑控制。 */
export const StatusFooter: React.FC<StatusFooterProps> = ({
  model,
  isConnected = false,
  isReconnecting = false,
  onReconnect,
}) => {
  const { chapterWords, wordTarget, totalWords, ghostText, isSaved, actions } = model
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
          aria-label={`本章进度 ${chapterWords.toLocaleString()} / ${wordTarget.toLocaleString()} 字`}
        >
          本章 {chapterWords.toLocaleString()} / {wordTarget.toLocaleString()} 字
        </span>
        <span
          data-testid="editor-total-words"
          className="tabular-nums"
          title="当前作品所有章节合计"
          aria-label={`全书总字数 ${totalWords.toLocaleString()} 字`}
        >
          全书 {totalWords.toLocaleString()} 字
        </span>

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
            type="button"
            onClick={() => actions.acceptGhostText()}
            aria-label="采纳续写建议"
            title="采纳续写建议"
            className="flex items-center gap-1 text-[var(--ink-accent)] hover:underline"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>Tab 采纳续写</span>
          </button>
        )}

        <span
          data-testid="editor-status-save-state"
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
