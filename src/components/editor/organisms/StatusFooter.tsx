import React from 'react'
import type { EditorModel, SaveState } from '../hooks/useChapterEditorModel'
import { shortcutLabel } from '../../../core/editorShortcuts'
import { Tooltip } from '../../../ui/primitives'

interface StatusFooterProps {
  model: EditorModel
  /** Kept for the RichEditor API; typewriter is not a footer control. */
  isTypewriter?: boolean
  onTypewriterChange?: (value: boolean) => void
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
}

/**
 * 保存状态的可理解用词（收口计划 P0.2）：状态栏不出现 revision、debounce、generation
 * 等内部概念。「保存失败 · 重试」渲染成按钮，重试的是防抖队列里最新那份草稿。
 */
const SAVE_STATE_VIEW: Record<SaveState, { label: string; hint: string; tone: string }> = {
  saved: { label: '已保存', hint: '内容已保存到本地工作区', tone: '' },
  unsaved: {
    label: '未保存',
    hint: `有改动等待自动保存，按 ${shortcutLabel('saveChapter')} 立即保存`,
    tone: 'text-[var(--ink-text-muted)]',
  },
  saving: { label: '正在保存…', hint: '正在写入本地工作区', tone: 'text-[var(--ink-text-muted)]' },
  error: {
    label: '保存失败 · 重试',
    hint: '上次保存失败，点击重试',
    tone: 'text-[var(--ink-danger)]',
  },
}

/** 底部状态栏：只呈现写作进度、连接和保存状态。 */
export const StatusFooter: React.FC<StatusFooterProps> = ({
  model,
  isConnected = false,
  isReconnecting = false,
  onReconnect,
}) => {
  const { chapterWords, wordTarget, totalWords, saveState, saveError } = model
  const saveView = SAVE_STATE_VIEW[saveState]
  const saveHint =
    saveState === 'error' && saveError ? `${saveView.hint}：${saveError}` : saveView.hint
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
        <Tooltip content="本章字数与每章目标">
          <span
            data-testid="editor-chapter-progress"
            data-status-kind="chapter-progress"
            className="tabular-nums"
            aria-label={`本章进度 ${chapterWords.toLocaleString()} / ${wordTarget.toLocaleString()} 字`}
          >
            本章 {chapterWords.toLocaleString()} / {wordTarget.toLocaleString()} 字
          </span>
        </Tooltip>
        <Tooltip content="当前作品所有章节合计">
          <span
            data-testid="editor-total-words"
            data-status-kind="book-progress"
            className="editor-total-words tabular-nums"
            aria-label={`全书总字数 ${totalWords.toLocaleString()} 字`}
          >
            全书 {totalWords.toLocaleString()} 字
          </span>
        </Tooltip>

        <Tooltip content="重连 InkPi Daemon">
          <button
            type="button"
            onClick={() => onReconnect?.()}
            disabled={isReconnecting}
            data-testid="editor-connection-status"
            data-status-kind="connection"
            aria-label={connectionDescription}
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
        </Tooltip>
      </div>

      <div className="editor-status-secondary min-w-0 flex shrink-0 items-center gap-3">
        <Tooltip content={saveHint}>
          <span
            data-testid="editor-status-save-state"
            data-status-kind="save"
            data-save-state={saveState}
            role="status"
            aria-label={saveHint}
            className={`editor-status-save-state ${saveView.tone}`}
          >
            {saveState === 'error' ? (
              <button
                type="button"
                onClick={() => model.actions.retrySave()}
                className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-[var(--ink-text)] transition-colors"
              >
                {saveView.label}
              </button>
            ) : (
              saveView.label
            )}
          </span>
        </Tooltip>
      </div>
    </footer>
  )
}
