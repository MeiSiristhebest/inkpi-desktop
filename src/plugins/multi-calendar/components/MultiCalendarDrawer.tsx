import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { MultiCalendarEngine } from '../engine/MultiCalendarEngine'
import type { MultiCalendarProjectRecord } from '../types'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

const DATE_TERM = /((?:大炎)?(?:天历|灵历|贞观|元丰|洪武|建安)[^，。\n]{2,15}(?:年|月|日))/

export const MultiCalendarDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [record, setRecord] = useState<MultiCalendarProjectRecord | null>(null)

  useEffect(() => {
    const load = async () => {
      const existing = await indexedDbMultiCalendarRepository.get(projectId)
      if (existing) setRecord(existing)
    }
    load()
  }, [projectId])

  // §P2.4：没有作者定义过的历法就是没有，不能退回内置的修真双历来凑一个"当前世界历法"
  const calendars = record?.calendars || []
  const events = record?.chronologyEvents || []
  const audit = MultiCalendarEngine.validateChronology(events)
  const detectedDate = DATE_TERM.exec(currentText ?? '')?.[0]?.trim() ?? null

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-indigo-500">
          <Calendar className="w-4 h-4" /> 多历法时间轴感知
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {calendars.length} 套并行历法
        </span>
      </div>

      {detectedDate && (
        <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 space-y-1">
          <div className="font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 正文中捕捉到纪年特征：
          </div>
          <div className="text-[11px] font-semibold">{detectedDate}</div>
          <div className="text-[10px] opacity-80">
            可在大纲视图中与全书编年史对账，防止产生时间倒流或岁月吃书。
          </div>
        </div>
      )}

      {/* 编年史单调性状态条 */}
      {events.length === 0 ? (
        <div className="p-2.5 rounded-lg border border-dashed border-[var(--ink-border)] text-[11px] text-[var(--ink-text-muted)]">
          全书尚未登记任何章节时间点，暂无时间线可自检。
        </div>
      ) : (
        <div
          className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
            audit.hasParadox
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <div className="font-bold flex items-center gap-1">
            {audit.hasParadox ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            全书时间线流动自检：
          </div>
          <p className="text-[10px] opacity-90">{audit.diagnostic}</p>
        </div>
      )}

      {/* 并行历法速查卡片 */}
      <div className="space-y-1.5">
        <div className="font-semibold text-[11px] text-[var(--ink-text-muted)]">
          本书已定义的历法：
        </div>
        {calendars.length === 0 && (
          <div className="p-2 rounded border border-dashed border-[var(--ink-border)] text-[10px] text-[var(--ink-text-muted)]">
            尚未定义任何历法。历法属于世界设定，需要你在大纲视图里新建，或显式套用流派预设。
          </div>
        )}
        <div className="space-y-1.5">
          {calendars.map((cal) => (
            <div
              key={cal.id}
              className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-0.5 text-[10px]"
            >
              <div className="font-bold text-[var(--ink-text)]">{cal.name}</div>
              <div className="text-[var(--ink-text-muted)]">
                {cal.monthsPerYear}个月/年 · 元年绝对基准偏移: {cal.epochOffsetDays} 天
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
