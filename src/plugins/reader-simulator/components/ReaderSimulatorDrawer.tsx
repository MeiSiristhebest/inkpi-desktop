import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { ReaderSimulatorEngine } from '../engine/ReaderSimulatorEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Users, Copy, Check, MessageSquare } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Tooltip } from '../../../ui/primitives'

export const ReaderSimulatorDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const text = (currentText ?? '').trim()

  const simulation = text
    ? ReaderSimulatorEngine.simulateChapter({
        chapterId: 'drawer-preview',
        chapterTitle: '实时段落随动',
        chapterOrder: 1,
        content: text,
      })
    : null

  const handleCopyComment = async (commentText: string, index: number) => {
    await clipboardWriter.writeText(commentText)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-rose-500">
          <Users className="w-4 h-4" /> 读者视角复核
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '写作内容感知' : '待输入正文'}
        </span>
      </div>

      {!simulation ? (
        <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)]">
          等待正文：这里不替示例句子打分。
        </div>
      ) : (
        <>
          <ScoreProvenanceBadge source="rule" detail="词项只定位问题；否定、转述与假设需要复核" />
          <p className="text-[var(--ink-text-muted)]">
            找到 {simulation.comments.length}{' '}
            类词项，每类展示首个命中的语境。未命中不能判断读者体验。
          </p>

          {/* 拟真段评预演 */}
          <ScoreProvenanceBadge
            source="inference"
            detail="原文定位与复核问题，不生成情绪或点赞数"
          />
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-rose-500" />
                原文复核问题 ({simulation.comments.length})
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
                        ? '待复核'
                        : c.sentiment === 'criticism'
                          ? '逻辑质疑'
                          : '待复核'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                    “{c.commentText}”
                  </p>
                  <div className="pt-1 flex items-center justify-between border-t border-[var(--ink-border)]/50">
                    <span className="text-[9px] text-[var(--ink-text-muted)]">
                      原文 [{c.sourceStart}, {c.sourceEnd})
                    </span>
                    <Tooltip content="复制本章说">
                      <button
                        onClick={() => handleCopyComment(c.commentText, idx)}
                        className="p-1 rounded hover:bg-[var(--ink-bg-panel)] text-[var(--ink-text-muted)] transition"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
