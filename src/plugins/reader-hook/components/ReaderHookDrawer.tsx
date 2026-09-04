import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { readerHookEngine } from '../engine/ReaderHookEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Anchor, Copy, Check, Sparkles } from 'lucide-react'

export const ReaderHookDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [inputText, setInputText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const textToAnalyze = inputText || (currentText ? currentText.slice(-300) : '')

  const analysis = useMemo(() => {
    return readerHookEngine.analyzeEnding(textToAnalyze)
  }, [textToAnalyze])

  const templates = readerHookEngine.getTemplates()

  const handleCopy = async (id: string, text: string) => {
    await clipboardWriter.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Anchor className="w-4 h-4 text-amber-500" />
          <span>章尾断章哨兵</span>
        </div>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? `正文随动感知` : '手动分析模式'}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          粘贴本章结尾 100~300 字：
        </label>
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="快速粘贴正文末尾段落进行追更张力诊断..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
      </div>

      {/* 实时张力评测卡片 */}
      <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[11px]">张力指数 (CTI):</span>
          <span
            className={`font-bold text-sm ${
              analysis.tensionScore >= 85
                ? 'text-rose-500'
                : analysis.tensionScore >= 70
                  ? 'text-amber-500'
                  : 'text-[var(--ink-text-muted)]'
            }`}
          >
            {analysis.tensionScore} 分
          </span>
        </div>
        <p className="text-[11px] text-[var(--ink-text)] leading-relaxed">{analysis.feedback}</p>
      </div>

      {/* 快捷断章例句注入 */}
      <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
        <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          断章范式灵感（一键复制）：
        </span>
        <div className="space-y-2">
          {templates.slice(0, 4).map((tpl) => (
            <div
              key={tpl.id}
              className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[10px] text-[var(--ink-text)]">{tpl.name}</span>
                <button
                  onClick={() => handleCopy(tpl.id, tpl.example)}
                  className="p-0.5 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
                  title="复制例句"
                >
                  {copiedId === tpl.id ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-[var(--ink-text-muted)] italic leading-tight">
                {tpl.example}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
