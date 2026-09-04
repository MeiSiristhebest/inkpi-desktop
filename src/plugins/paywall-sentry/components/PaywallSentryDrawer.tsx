import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { PaywallSentryEngine } from '../engine/PaywallSentryEngine'
import type { PaywallAuditResult } from '../types'
import { Flame, ShieldCheck, AlertTriangle, Skull } from 'lucide-react'

export const PaywallSentryDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [inputText, setInputText] = useState('')

  const textToAnalyze = inputText || currentText || ''

  const audit: PaywallAuditResult = useMemo(() => {
    return PaywallSentryEngine.analyzeChapter({
      chapterId: 'drawer-current',
      chapterTitle: '当前章节',
      chapterOrder: 1,
      content: textToAnalyze,
    })
  }, [textToAnalyze])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-amber-500">
          <Flame className="w-4 h-4" /> 付费卡点哨兵 (PPI)
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '编辑器联动感知' : '手动诊断模式'}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          快速诊断正文（留空则联动编辑器正文）：
        </label>
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="粘贴章尾或整章文本，评估读者付费留存率与断章势能..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 rounded-lg border border-amber-500/30">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-medium text-[var(--ink-text)]">PPI 势能评分</span>
          <span className="text-xl font-bold text-amber-500">
            {audit.ppiScore} / 100
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all"
            style={{ width: `${audit.ppiScore}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] flex items-center gap-1">
          {audit.recommendation === 'prime_paywall' && (
            <span className="text-amber-500 flex items-center gap-1 font-semibold">
              <Flame className="w-3.5 h-3.5" /> 黄金卡点：极度适合作为收费分界点！
            </span>
          )}
          {audit.recommendation === 'acceptable' && (
            <span className="text-emerald-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 合格卡点：具备承接付费转化的张力。
            </span>
          )}
          {audit.recommendation === 'weak_cut' && (
            <span className="text-[var(--ink-text-muted)] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 偏弱卡点：建议强化末尾断章悬念。
            </span>
          )}
          {audit.recommendation === 'toxic_drop' && (
            <span className="text-rose-500 flex items-center gap-1 font-medium">
              <Skull className="w-3.5 h-3.5" /> 危险断点：说明性文字过多，易引起弃书！
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 bg-[var(--ink-bg-elevated)] p-2.5 rounded-lg border border-[var(--ink-border)]">
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">末尾悬念强度 (C):</span>
          <span className="font-semibold">{audit.cliffhangerScore}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">核心期待唤醒 (D):</span>
          <span className="font-semibold">{audit.unresolvedDesireScore}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">战力爽点高潮 (P):</span>
          <span className="font-semibold">{audit.powerClimaxScore}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">疲劳冗余风险 (F):</span>
          <span className={`font-semibold ${audit.fatigueRiskScore > 50 ? 'text-rose-500' : ''}`}>
            {audit.fatigueRiskScore}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="font-medium text-[var(--ink-text)] text-[11px]">实战修改建议：</div>
        {audit.suggestions.map((item, idx) => (
          <div
            key={idx}
            className="p-2 bg-[var(--ink-bg-canvas)] rounded border border-[var(--ink-border)] text-[11px] leading-relaxed text-[var(--ink-text-muted)]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
