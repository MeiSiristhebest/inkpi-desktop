import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { ReaderSimulatorEngine } from '../engine/ReaderSimulatorEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Users, AlertTriangle, ShieldCheck, Copy, Check, MessageSquare } from 'lucide-react'

export const ReaderSimulatorDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const simulation = ReaderSimulatorEngine.simulateChapter({
    chapterId: 'drawer-preview',
    chapterTitle: '实时段落随动',
    chapterOrder: 1,
    content: currentText || '主角行走在茫茫风雪中，前途未卜。',
  })

  const handleCopyComment = async (commentText: string, index: number) => {
    await clipboardWriter.writeText(commentText)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-rose-500">
          <Users className="w-4 h-4" /> 读者心智段评随动
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '写作内容感知' : '待输入正文'}
        </span>
      </div>

      {/* 核心指标微表盘 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <div className="text-[10px] text-[var(--ink-text-muted)]">毒点指数</div>
          <div
            className={`font-bold text-sm ${
              simulation.toxicityScore > 30 ? 'text-red-500' : 'text-emerald-500'
            }`}
          >
            {simulation.toxicityScore}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <div className="text-[10px] text-[var(--ink-text-muted)]">逻辑推演</div>
          <div className="font-bold text-sm text-blue-500">{simulation.logicScore}</div>
        </div>
        <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <div className="text-[10px] text-[var(--ink-text-muted)]">爽感留存</div>
          <div className="font-bold text-sm text-amber-500">{simulation.pleasureScore}</div>
        </div>
      </div>

      {/* 毒点警告提示 */}
      {simulation.toxicAlerts.length > 0 ? (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 space-y-1">
          <div className="font-semibold flex items-center gap-1 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" /> 发现敏感毒点
          </div>
          {simulation.toxicAlerts.map((alert, idx) => (
            <div key={idx} className="text-[10px] opacity-90">
              {alert}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" /> 暂未检测到明显毒点与退订风险
        </div>
      )}

      {/* 拟真段评预演 */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-rose-500" />
            段评/本章说弹幕预演 ({simulation.comments.length})
          </span>
        </div>

        <div className="space-y-2">
          {simulation.comments.map((c, idx) => (
            <div
              key={c.id || idx}
              className="p-2.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-[var(--ink-text)]">
                  {c.authorName}
                </span>
                <span
                  className={`text-[9px] px-1 rounded ${
                    c.sentiment === 'toxic_alert'
                      ? 'bg-red-500/20 text-red-500'
                      : c.sentiment === 'criticism'
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'bg-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {c.sentiment === 'toxic_alert'
                    ? '毒点弃书'
                    : c.sentiment === 'criticism'
                    ? '逻辑质疑'
                    : '爽快催更'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                “{c.commentText}”
              </p>
              <div className="pt-1 flex items-center justify-between border-t border-[var(--ink-border)]/50">
                <span className="text-[9px] text-[var(--ink-text-muted)]">
                  点赞: {c.upvotes}
                </span>
                <button
                  onClick={() => handleCopyComment(c.commentText, idx)}
                  className="p-1 rounded hover:bg-[var(--ink-bg-panel)] text-[var(--ink-text-muted)] transition"
                  title="复制本章说"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
