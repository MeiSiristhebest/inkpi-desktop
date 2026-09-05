import { useState, useMemo, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { EmotionCurveEngine } from '../engine/EmotionCurveEngine'
import type { ChapterEmotionEvaluation } from '../types'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { Activity } from 'lucide-react'

export const EmotionCurveDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [inputText, setInputText] = useState('')
  const [auditNotice, setAuditNotice] = useState<{ waterScore?: number; wordCount: number } | null>(null)

  // 订阅 CHAPTER_CONTENT_AUDITED 事件，联动展示水分审计结果
  useEffect(() => {
    const unsub = pluginEventBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      if (payload.projectId === projectId) {
        setAuditNotice({
          waterScore: payload.waterScore,
          wordCount: payload.wordCount,
        })
      }
    })
    return () => {
      unsub()
    }
  }, [projectId])

  const textToAnalyze = inputText || currentText || ''

  const evalResult: ChapterEmotionEvaluation = useMemo(() => {
    return EmotionCurveEngine.evaluateChapter({
      chapterId: 'drawer-eval',
      chapterTitle: '当前章节',
      chapterOrder: 1,
      content: textToAnalyze,
    })
  }, [textToAnalyze])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-rose-500">
          <Activity className="w-4 h-4" /> 读者情绪心电图
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '编辑器正文联动' : '手动输入'}
        </span>
      </div>

      {auditNotice && (
        <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] flex justify-between items-center">
          <span>正文审计联动: {auditNotice.wordCount} 字</span>
          {typeof auditNotice.waterScore === 'number' && (
            <span className="font-semibold">水分值: {auditNotice.waterScore}</span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          即时诊断正文（留空联动当前章节）：
        </label>
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="粘贴正文片段，即时诊断爽点释放、危机张力与代入共鸣度..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
      </div>

      <div className="bg-[var(--ink-bg-elevated)] p-3 rounded-lg border border-[var(--ink-border)] space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-[var(--ink-text)]">情绪净极性 (Polarity)</span>
          <span
            className={`font-bold text-sm ${
              evalResult.netPolarity > 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {evalResult.netPolarity > 0 ? `+${evalResult.netPolarity} (扬升)` : `${evalResult.netPolarity} (蓄势)`}
          </span>
        </div>

        <div className="space-y-1 text-[11px] text-[var(--ink-text-muted)]">
          <div className="flex justify-between">
            <span>代入共鸣深度:</span>
            <span className="font-semibold text-[var(--ink-text)]">{evalResult.resonanceScore} / 100</span>
          </div>
          <div className="flex justify-between">
            <span>主导情绪基调:</span>
            <span className="font-semibold text-rose-500">{evalResult.dominantEmotion}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 bg-[var(--ink-bg-canvas)] p-2.5 rounded-lg border border-[var(--ink-border)]">
        <div className="font-medium text-[11px] text-[var(--ink-text)] mb-1">六维情绪光谱分解：</div>
        <div className="flex justify-between text-[11px]">
          <span className="text-amber-500">爽感释放 (Catharsis):</span>
          <span className="font-semibold">{evalResult.vector.catharsis}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-blue-500">悬念期待 (Anticipation):</span>
          <span className="font-semibold">{evalResult.vector.anticipation}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-500">危机紧绷 (Tension):</span>
          <span className="font-semibold">{evalResult.vector.tension}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-rose-500">压抑受挫 (Frustration):</span>
          <span className="font-semibold">{evalResult.vector.frustration}</span>
        </div>
      </div>

      {evalResult.warnings.length > 0 && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-[11px] space-y-1">
          {evalResult.warnings.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>
      )}

      {evalResult.suggestions.length > 0 && (
        <div className="space-y-1 text-[11px] text-[var(--ink-text-muted)]">
          <div className="font-medium text-[var(--ink-text)]">情绪张弛优化建议：</div>
          {evalResult.suggestions.map((s, idx) => (
            <div key={idx} className="p-1.5 bg-[var(--ink-bg-elevated)] rounded border border-[var(--ink-border)]">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
