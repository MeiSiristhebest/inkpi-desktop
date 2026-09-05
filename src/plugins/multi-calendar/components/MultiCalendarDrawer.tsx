import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { MultiCalendarEngine } from '../engine/MultiCalendarEngine'
import type { MultiCalendarProjectRecord } from '../types'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const MultiCalendarDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [record, setRecord] = useState<MultiCalendarProjectRecord | null>(null)
  const [detectedDate, setDetectedDate] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const existing = await indexedDbMultiCalendarRepository.get(projectId)
      if (existing) setRecord(existing)
    }
    load()
  }, [projectId])

  const calendars = record?.calendars || MultiCalendarEngine.DEFAULT_CALENDARS
  const events = record?.chronologyEvents || []
  const audit = MultiCalendarEngine.validateChronology(events)

  useEffect(() => {
    if (!currentText) {
      setDetectedDate(null)
      return
    }
    // 文本时间词特征自动捕获
    const match = currentText.match(
      /((?:大炎)?(?:天历|灵历|贞观|元丰|洪武|建安)[^，。\n]{2,15}(?:年|月|日))/,
    )
    if (match) {
      const captured = match[0].trim()
      setDetectedDate(captured)

      // 自动向全系统广播 TIMELINE_EVENT_REGISTERED
      try {
        pluginEventBus.emit('TIMELINE_EVENT_REGISTERED', {
          projectId,
          chapterId: 'current',
          calendarId: calendars[0]?.id || 'cal_ancient',
          universalAbsoluteDay: 100, // 估算标量日
          summary: captured,
        })
      } catch (err) {
        console.warn('[MultiCalendarDrawer] Failed to emit TIMELINE_EVENT_REGISTERED:', err)
      }
    }
  }, [currentText, projectId, calendars])

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

      {/* 并行历法速查卡片 */}
      <div className="space-y-1.5">
        <div className="font-semibold text-[11px] text-[var(--ink-text-muted)]">
          当前世界并行的历法体系：
        </div>
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
