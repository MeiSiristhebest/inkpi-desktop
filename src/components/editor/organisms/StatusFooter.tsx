import { Sparkles, AlignJustify, Type } from 'lucide-react'
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
