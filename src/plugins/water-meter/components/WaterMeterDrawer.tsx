import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { waterMeterEngine } from '../engine/WaterMeterEngine'
import { Droplet, Sparkles, Scissors } from 'lucide-react'

export const WaterMeterDrawer: FC<DesktopPluginDrawerProps> = () => {
  const [text, setText] = useState('')

  const report = useMemo(() => {
    return waterMeterEngine.auditText(text)
  }, [text])

  const handleClearBloat = () => {
    let cleaned = text
    for (const item of report.bloatItems) {
      cleaned = cleaned.replaceAll(item.text, '')
    }
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim()
    setText(cleaned)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Droplet className="w-4 h-4 text-cyan-500" />
          <span>正文水分与信息熵</span>
        </div>
        <span
          className={`text-[11px] font-bold ${
            report.waterScore > 50
              ? 'text-rose-500'
              : report.waterScore > 25
                ? 'text-amber-500'
                : 'text-emerald-500'
          }`}
        >
          {report.waterScore} 分 · {report.waterLevel}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          粘贴当前段落进行实时脱水检测：
        </label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴待审文字，实时检测假动作与套话..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
        {report.bloatItems.length > 0 && (
          <button
            onClick={handleClearBloat}
            className="w-full py-1 rounded bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-emerald-500 text-emerald-500 text-xs font-medium flex items-center justify-center gap-1"
          >
            <Scissors className="w-3 h-3" />
            一键剔除当前抓捕到的水词 ({report.bloatItems.length})
          </button>
        )}
      </div>

      {/* 核心指标卡 */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60">
          <span className="text-[var(--ink-text-muted)] block">动词密度 (AVR)</span>
          <span className="font-bold text-[var(--ink-text)]">
            {(report.actionVerbRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60">
          <span className="text-[var(--ink-text-muted)] block">预估可精简</span>
          <span className="font-bold text-emerald-500">
            -{report.dehydrationRate}%
          </span>
        </div>
      </div>

      {/* 抓取水词列表 */}
      {report.bloatItems.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--ink-border)]">
          <span className="text-[11px] font-semibold text-rose-400 block">
            捕获水词 ({report.bloatItems.length}):
          </span>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {report.bloatItems.map((item, i) => (
              <div
                key={i}
                className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-rose-500/20 text-[10px] flex items-center justify-between"
              >
                <span className="font-medium text-rose-400">“{item.text}”</span>
                <span className="text-[var(--ink-text-muted)]">{item.type}</span>
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
          {report.advice[0] || '叙事密度良好。'}
        </p>
      </div>
    </div>
  )
}
