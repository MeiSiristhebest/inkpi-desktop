import { useState, useMemo, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { waterMeterEngine } from '../engine/WaterMeterEngine'
import { Droplet, Sparkles } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'

export const WaterMeterDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [text, setText] = useState(currentText ?? '')
  useEffect(() => {
    setText(currentText ?? '')
  }, [currentText])

  const report = useMemo(() => {
    return waterMeterEngine.auditText(text)
  }, [text])

  const handleRemove = (start?: number, end?: number, quote?: string) => {
    if (start === undefined || end === undefined || text.slice(start, end) !== quote) return
    setText(text.slice(0, start) + text.slice(end))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Droplet className="w-4 h-4 text-cyan-500" />
          <span>文本统计与词项复核</span>
        </div>
        <span className="text-[11px]">{report.bloatItems.length} 处词项</span>
      </div>

      <ScoreProvenanceBadge source="rule" detail="字符频率与词项覆盖率不判断文学质量" />

      <div className="space-y-2">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          当前正文预览，可编辑以复核：
        </label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴待审文字，实时检测假动作与套话..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
        <p className="text-[var(--ink-text-muted)]">
          这里只修改预览。正文词项可能承担必要作用，请逐处复核。
        </p>
      </div>

      {/* 核心指标卡 */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60">
          <span className="text-[var(--ink-text-muted)] block">动作词表字符占比</span>
          <span className="font-bold text-[var(--ink-text)]">
            {(report.actionVerbRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60">
          <span className="text-[var(--ink-text-muted)] block">词项覆盖字符</span>
          <span className="font-bold">
            {report.matchedCharacters} · {(report.clicheRatio * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 抓取水词列表 */}
      {report.bloatItems.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--ink-border)]">
          <span className="text-[11px] font-semibold text-rose-400 block">
            原文词项 ({report.bloatItems.length}):
          </span>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {report.bloatItems.map((item, i) => (
              <div
                key={i}
                className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-rose-500/20 text-[10px] flex items-center justify-between"
              >
                <span className="font-medium text-rose-400">“{item.text}”</span>
                <button type="button" onClick={() => handleRemove(item.start, item.end, item.text)}>
                  移除该处（预览）
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 写作建议 */}
      <div className="p-2.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60 space-y-1">
        <span className="text-[10px] font-semibold text-[var(--ink-text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          精简建议：
        </span>
        <p className="text-[10px] text-[var(--ink-text)] leading-relaxed">
          {report.advice[0] || '词表没有命中，无法据此判断叙事作用。'}
        </p>
      </div>
    </div>
  )
}
