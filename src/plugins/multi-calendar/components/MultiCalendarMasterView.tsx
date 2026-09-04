import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { MultiCalendarEngine } from '../engine/MultiCalendarEngine'
import type {
  CalendarDefinition,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  ChronologyAuditResult,
} from '../types'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import type { ChapterRecord } from '../../../types'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  Trash2,
  BookmarkCheck,
  CheckCircle2,
} from 'lucide-react'

export const MultiCalendarMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [record, setRecord] = useState<MultiCalendarProjectRecord | null>(null)
  const [calendars, setCalendars] = useState<CalendarDefinition[]>(MultiCalendarEngine.DEFAULT_CALENDARS)
  const [events, setEvents] = useState<ChapterChronologyEvent[]>([])
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  // 跨历法换算器表单状态
  const [sourceCalId, setSourceCalId] = useState<string>('cal_ancient')
  const [targetCalId, setTargetCalId] = useState<string>('cal_dynasty')
  const [inputYear, setInputYear] = useState<number>(1001)
  const [inputMonth, setInputMonth] = useState<number>(1)
  const [inputDay, setInputDay] = useState<number>(1)

  // 章节时间登记表单
  const [chapters, setChapters] = useState<ChapterRecord[]>([])
  const [eventChapterId, setEventChapterId] = useState<string>('')
  const [eventCalId, setEventCalId] = useState<string>('cal_ancient')
  const [eventYear, setEventYear] = useState<number>(100)
  const [eventMonth, setEventMonth] = useState<number>(1)
  const [eventDay, setEventDay] = useState<number>(1)
  const [eventSummary, setEventSummary] = useState<string>('')

  const loadData = async () => {
    const [existing, allChapters] = await Promise.all([
      indexedDbMultiCalendarRepository.get(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])

    allChapters.sort((a, b) => a.order - b.order)
    setChapters(allChapters)
    if (allChapters.length > 0 && !eventChapterId) {
      setEventChapterId(allChapters[0].id)
    }

    if (existing) {
      setRecord(existing)
      setCalendars(existing.calendars)
      setEvents(existing.chronologyEvents)
    } else {
      const initial: MultiCalendarProjectRecord = {
        id: idGenerator.generate('calproj'),
        projectId,
        calendars: MultiCalendarEngine.DEFAULT_CALENDARS,
        chronologyEvents: [],
        updatedAt: clock.now(),
      }
      setRecord(initial)
      setCalendars(initial.calendars)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  // 历法换算计算
  const conversionResult = useMemo(() => {
    const sCal = calendars.find((c) => c.id === sourceCalId) || calendars[0]
    const tCal = calendars.find((c) => c.id === targetCalId) || calendars[1] || calendars[0]
    return MultiCalendarEngine.convertCalendarDate({
      sourceCalendar: sCal,
      targetCalendar: tCal,
      sourceDate: { year: inputYear, month: inputMonth, day: inputDay },
    })
  }, [sourceCalId, targetCalId, inputYear, inputMonth, inputDay, calendars])

  // 时间倒流悖论巡检
  const chronologyAudit: ChronologyAuditResult = useMemo(() => {
    return MultiCalendarEngine.validateChronology(events)
  }, [events])

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    const targetChap = chapters.find((c) => c.id === eventChapterId)
    const cal = calendars.find((c) => c.id === eventCalId) || calendars[0]
    const absDay = MultiCalendarEngine.toAbsoluteDay(cal, {
      year: eventYear,
      month: eventMonth,
      day: eventDay,
    })

    const newEvent: ChapterChronologyEvent = {
      chapterId: eventChapterId,
      chapterOrder: targetChap ? targetChap.order : 1,
      chapterTitle: targetChap ? targetChap.title : '未命名章节',
      timePoint: {
        calendarId: eventCalId,
        year: eventYear,
        month: eventMonth,
        day: eventDay,
        absoluteDayIndex: absDay,
      },
      eventSummary: eventSummary.trim() || '主要剧情发生点',
    }

    // 过滤掉同章节原事件并追加
    const updated = [...events.filter((ev) => ev.chapterId !== eventChapterId), newEvent]
    updated.sort((a, b) => a.chapterOrder - b.chapterOrder)
    setEvents(updated)
    setEventSummary('')
  }

  const handleRemoveEvent = (chapterId: string) => {
    setEvents(events.filter((ev) => ev.chapterId !== chapterId))
  }

  const handleSaveAll = async () => {
    if (!record) return
    const updated: MultiCalendarProjectRecord = {
      ...record,
      calendars,
      chronologyEvents: events,
      updatedAt: clock.now(),
    }
    await indexedDbMultiCalendarRepository.save(updated)
    setSavedSuccessMsg('跨历法时间轴档案已成功保存！')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarIcon className="w-6 h-6 text-indigo-500" />
            跨纪元多历法与故事时间轴引擎 (Multi-Calendar)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            并行史诗历法定义、全宇宙绝对标量日双向换算与章节时间单调性巡检，根除编年史倒流 Bug。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveAll}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <BookmarkCheck className="w-4 h-4" /> 保存历法时间线
          </button>
        </div>
      </div>

      {/* 倒流悖论预警条 */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition ${
          chronologyAudit.hasParadox
            ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
            : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {chronologyAudit.hasParadox ? (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <span className="font-bold">{chronologyAudit.diagnostic}</span>
        </div>
        {chronologyAudit.hasParadox && (
          <span className="font-semibold px-2 py-0.5 rounded bg-rose-500 text-white text-[11px]">
            {chronologyAudit.paradoxCount} 处悖论待修复
          </span>
        )}
      </div>

      {/* 跨历法实时对账换算器 */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <ArrowRightLeft className="w-4 h-4" />
          平行历法双向精准换算器
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end">
          <div>
            <label className="block mb-1 text-slate-500">来源历法系统：</label>
            <select
              value={sourceCalId}
              onChange={(e) => setSourceCalId(e.target.value)}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 grid grid-cols-3 gap-1.5">
            <div>
              <label className="block mb-1 text-slate-500">年：</label>
              <input
                type="number"
                value={inputYear}
                onChange={(e) => setInputYear(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">月：</label>
              <input
                type="number"
                min={1}
                max={12}
                value={inputMonth}
                onChange={(e) => setInputMonth(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">日：</label>
              <input
                type="number"
                min={1}
                max={31}
                value={inputDay}
                onChange={(e) => setInputDay(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-slate-500">换算目标历法：</label>
            <select
              value={targetCalId}
              onChange={(e) => setTargetCalId(e.target.value)}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 换算结果卡片 */}
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300">
            <div className="text-[10px] text-indigo-500">折合标量天数与对应日期：</div>
            <div className="font-bold text-xs mt-0.5">
              {conversionResult.targetDate.year} 年 {conversionResult.targetDate.month} 月 {conversionResult.targetDate.day} 日
            </div>
            <div className="text-[10px] opacity-75">绝对第 {conversionResult.absoluteDayIndex} 天</div>
          </div>
        </div>
      </div>

      {/* 章节故事时间登记表单 */}
      <form
        onSubmit={handleAddEvent}
        className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs"
      >
        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-indigo-500" />
          登记章节故事时间锚点 (In-Story Timeline)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block mb-1 text-slate-500">关联章节：</label>
            <select
              value={eventChapterId}
              onChange={(e) => setEventChapterId(e.target.value)}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  第 {c.order} 章：{c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-slate-500">采用历法：</label>
            <select
              value={eventCalId}
              onChange={(e) => setEventCalId(e.target.value)}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block mb-1 text-slate-500">年：</label>
              <input
                type="number"
                value={eventYear}
                onChange={(e) => setEventYear(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">月：</label>
              <input
                type="number"
                min={1}
                max={12}
                value={eventMonth}
                onChange={(e) => setEventMonth(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">日：</label>
              <input
                type="number"
                min={1}
                max={31}
                value={eventDay}
                onChange={(e) => setEventDay(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full p-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 登记时间锚点
            </button>
          </div>
        </div>
      </form>

      {/* 故事时间线节点瀑布流 */}
      <div className="space-y-2 flex-1">
        <div className="font-bold text-xs text-slate-500">全书编年史序列 ({events.length} 个时间节点)</div>
        {events.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs">
            暂无已登记章节时间点。在上方登记后将自动进行因果单调性巡检。
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.chapterId}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
                  第 {ev.chapterOrder} 章
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {ev.chapterTitle}
                </span>
                <span className="text-slate-400">
                  【{calendars.find((c) => c.id === ev.timePoint.calendarId)?.name}】
                  {ev.timePoint.year}年{ev.timePoint.month}月{ev.timePoint.day}日
                  (绝对宇宙天数: {ev.timePoint.absoluteDayIndex})
                </span>
              </div>

              <button
                onClick={() => handleRemoveEvent(ev.chapterId)}
                className="p-1 rounded text-slate-400 hover:text-red-500 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
