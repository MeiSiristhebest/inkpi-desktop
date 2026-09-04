import { type FC } from 'react'
import type { PromiseLedgerEntry } from '../types'
import { ledgerEngine } from '../engine/LedgerEngine'

interface DebtGanttChartProps {
  entries: PromiseLedgerEntry[]
  currentChapter: number
  totalChapters?: number
  onSelectEntry?: (entry: PromiseLedgerEntry) => void
}

export const DebtGanttChart: FC<DebtGanttChartProps> = ({
  entries,
  currentChapter,
  totalChapters = 50,
  onSelectEntry,
}) => {
  const maxCh = Math.max(
    totalChapters,
    currentChapter + 5,
    ...entries.map((e) => e.plantChapter + e.dueChapterLimit + 5),
  )

  const chapterTicks = Array.from({ length: Math.min(25, Math.ceil(maxCh / 5) + 1) }, (_, i) => i * 5)

  return (
    <div className="w-full bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-lg p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-3 text-xs text-[var(--ink-text-muted)]">
        <div className="font-semibold text-[var(--ink-text)] flex items-center gap-2">
          <span>伏笔时空甘特轴</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
            当前写作位置：第 {currentChapter} 章
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80 inline-block" /> 正常期
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/80 inline-block" /> 软告警
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block" /> 超期红线
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80 inline-block" /> 已回收
          </span>
        </div>
      </div>

      <div className="min-w-[640px] relative pt-6 pb-2">
        {/* 章节刻度标尺 */}
        <div className="relative h-5 border-b border-[var(--ink-border)] text-[10px] text-[var(--ink-text-faint)]">
          {chapterTicks.map((ch) => {
            const leftPct = (ch / maxCh) * 100
            if (leftPct > 100) return null
            return (
              <div
                key={ch}
                style={{ left: `${leftPct}%` }}
                className="absolute transform -translate-x-1/2 flex flex-col items-center"
              >
                <span>{ch}</span>
                <div className="w-px h-1 bg-[var(--ink-border)]" />
              </div>
            )
          })}
        </div>

        {/* 当前章节红线指针 */}
        <div
          style={{ left: `${Math.min(100, (currentChapter / maxCh) * 100)}%` }}
          className="absolute top-6 bottom-0 w-px bg-rose-500/60 z-20 pointer-events-none"
        >
          <div className="absolute -top-3 -translate-x-1/2 px-1 py-0.2 rounded bg-rose-500 text-white text-[9px]">
            当前
          </div>
        </div>

        {/* 伏笔行数据 */}
        <div className="divide-y divide-[var(--ink-border)]/40 mt-1">
          {entries.map((entry) => {
            const plantPct = (entry.plantChapter / maxCh) * 100
            const softCh = entry.plantChapter + entry.softDeadline
            const softPct = (softCh / maxCh) * 100
            const dueCh = entry.plantChapter + entry.dueChapterLimit
            const duePct = (dueCh / maxCh) * 100

            const isPaid = entry.status === 'paid_off'
            const isOverdue = !isPaid && currentChapter >= dueCh
            const heat = ledgerEngine.computeMemoryHeat(entry, currentChapter)

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry?.(entry)}
                className="group relative h-9 flex items-center hover:bg-[var(--ink-bg-hover)] cursor-pointer px-1 rounded transition-colors"
              >
                {/* 伏笔标签 */}
                <div className="w-36 shrink-0 truncate text-xs font-medium text-[var(--ink-text)] flex items-center gap-1.5 pr-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isPaid ? 'bg-blue-400' : isOverdue ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="truncate" title={entry.clueName}>
                    {entry.clueName}
                  </span>
                </div>

                {/* 进度条轨道 */}
                <div className="flex-1 relative h-4 bg-[var(--ink-bg-canvas)] rounded overflow-hidden">
                  {/* 安全区间 */}
                  <div
                    style={{
                      left: `${plantPct}%`,
                      width: `${Math.max(1, softPct - plantPct)}%`,
                    }}
                    className="absolute top-0 bottom-0 bg-emerald-500/30 border-l-2 border-emerald-500"
                    title={`第${entry.plantChapter}章埋设`}
                  />

                  {/* 软告警区间 */}
                  <div
                    style={{
                      left: `${softPct}%`,
                      width: `${Math.max(1, duePct - softPct)}%`,
                    }}
                    className="absolute top-0 bottom-0 bg-amber-500/35 border-l-2 border-amber-500"
                    title={`第${softCh}章进入告警`}
                  />

                  {/* 超期溢出区间 */}
                  {currentChapter > dueCh && !isPaid && (
                    <div
                      style={{
                        left: `${duePct}%`,
                        width: `${Math.max(1, ((currentChapter - dueCh) / maxCh) * 100)}%`,
                      }}
                      className="absolute top-0 bottom-0 bg-rose-500/40 border-l-2 border-rose-500 animate-pulse"
                      title={`已超期 ${currentChapter - dueCh} 章`}
                    />
                  )}

                  {/* 兑现点标记 */}
                  {entry.payoffChapter && (
                    <div
                      style={{ left: `${(entry.payoffChapter / maxCh) * 100}%` }}
                      className="absolute top-0 bottom-0 w-1.5 bg-blue-500 -translate-x-1/2 z-10"
                      title={`第${entry.payoffChapter}章兑现`}
                    />
                  )}
                </div>

                {/* 记忆热度徽章 */}
                <div className="w-16 shrink-0 text-right text-[10px] pl-2 text-[var(--ink-text-faint)]">
                  热度 {Math.round(heat * 100)}%
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
