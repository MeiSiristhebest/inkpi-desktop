import { projectContent, resolveSourceEvidenceRange } from '../../../domain/content'
import { useState, useEffect, useMemo, useCallback, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { MultiCalendarEngine } from '../engine/MultiCalendarEngine'
import { buildChronologyScanInput } from '../engine/chronologyScanInput'
import type {
  CalendarDefinition,
  ChronologySequenceRole,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  ChronologyAuditResult,
} from '../types'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { createProvenance } from '../../../domain/story/provenance'
import { useOptionalActiveWritingContext } from '../../../core/activeWritingContext'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  Trash2,
  BookmarkCheck,
  CheckCircle2,
  Bot,
} from 'lucide-react'
import { Select } from '../../../ui/primitives'

export const MultiCalendarMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const activeWriting = useOptionalActiveWritingContext()
  const [record, setRecord] = useState<MultiCalendarProjectRecord | null>(null)
  // §P2.4：历法属于本书的世界设定。空工作区一律从空白开始，内置的修真双历只能由作者点「套用」拿到，
  // 不能在「用户没配置」时被当成默认历法写进档案。
  const [calendars, setCalendars] = useState<CalendarDefinition[]>([])
  const [events, setEvents] = useState<ChapterChronologyEvent[]>([])
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  // 跨历法换算器表单状态
  const [sourceCalId, setSourceCalId] = useState<string>('')
  const [targetCalId, setTargetCalId] = useState<string>('')
  const [inputYear, setInputYear] = useState<number>(1)
  const [inputMonth, setInputMonth] = useState<number>(1)
  const [inputDay, setInputDay] = useState<number>(1)

  // 新建历法表单
  const [newCalName, setNewCalName] = useState('')
  const [newCalMonths, setNewCalMonths] = useState<number>(12)
  const [newCalDays, setNewCalDays] = useState<number>(30)
  const [newCalEpochOffset, setNewCalEpochOffset] = useState<number>(0)
  const [calendarError, setCalendarError] = useState('')

  // 章节时间登记表单
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const chronologyScan = useMemo(() => buildChronologyScanInput(chapters), [chapters])
  const aiTask = usePluginAiTask('multi-calendar', [projectId, chronologyScan.input])
  const [eventChapterId, setEventChapterId] = useState<string>('')
  const [eventCalId, setEventCalId] = useState<string>('')
  const [eventYear, setEventYear] = useState<number>(1)
  const [eventMonth, setEventMonth] = useState<number>(1)
  const [eventDay, setEventDay] = useState<number>(1)
  const [eventSequenceRole, setEventSequenceRole] = useState<ChronologySequenceRole>('unknown')
  const [eventSummary, setEventSummary] = useState<string>('')
  const [eventSourceExcerpt, setEventSourceExcerpt] = useState('')
  const [eventSourceError, setEventSourceError] = useState<string | null>(null)
  const [chronologyNavigationMessage, setChronologyNavigationMessage] = useState<string | null>(
    null,
  )

  const loadData = useCallback(async () => {
    const [existing, allChapters, volumes] = await Promise.all([
      indexedDbMultiCalendarRepository.get(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
    ])

    const positionedChapters = projectChapterSequence(projectId, allChapters, volumes)
    const chaptersById = new Map(positionedChapters.map((chapter) => [chapter.id, chapter]))
    setChapters(positionedChapters)
    if (positionedChapters.length > 0 && !eventChapterId) {
      setEventChapterId(positionedChapters[0].id)
    }

    if (existing) {
      setRecord(existing)
      setCalendars(existing.calendars)
      setEvents(
        existing.chronologyEvents.map((event) => {
          const chapter = chaptersById.get(event.chapterId)
          return {
            ...event,
            chapterOrder: chapter?.chapterNumber ?? null,
            ...(chapter ? { chapterTitle: chapter.title } : {}),
          }
        }),
      )
    }
  }, [projectId, eventChapterId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // AI 逆向扫描各章时间标注，防时间倒流
  const handleAiChronologyScan = async () => {
    if (!chronologyScan.sampledChapterCount) return
    await aiTask.run(chronologyScan.input)
  }

  // 历法换算计算：不足两套历法时不给出任何换算结果，而不是拿内置双历凑一个数
  const conversionResult = useMemo(() => {
    const sCal = calendars.find((c) => c.id === sourceCalId) || calendars[0]
    const tCal = calendars.find((c) => c.id === targetCalId) || calendars[1]
    if (!sCal || !tCal || sCal.id === tCal.id) return { result: null, error: '' }
    try {
      return {
        result: MultiCalendarEngine.convertCalendarDate({
          sourceCalendar: sCal,
          targetCalendar: tCal,
          sourceDate: { year: inputYear, month: inputMonth, day: inputDay },
        }),
        error: '',
      }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : '日期无法换算。' }
    }
  }, [sourceCalId, targetCalId, inputYear, inputMonth, inputDay, calendars])

  // Only author-marked mainline events are compared.
  const chronologyAudit: ChronologyAuditResult = useMemo(() => {
    return MultiCalendarEngine.validateChronology(events)
  }, [events])

  const handleApplyCalendarPreset = () => {
    setCalendars(MultiCalendarEngine.GENRE_PRESET_CALENDARS.map((c) => ({ ...c })))
  }

  const handleAddCalendar = () => {
    const name = newCalName.trim()
    if (!name) return
    const months = newCalMonths
    if (
      !Number.isSafeInteger(months) ||
      months < 1 ||
      months > 1000 ||
      !Number.isSafeInteger(newCalDays) ||
      newCalDays < 1 ||
      !Number.isSafeInteger(newCalEpochOffset)
    ) {
      setCalendarError('请填写整数月份数、正整数月长和整数纪元偏移；当前最多支持 1000 个月。')
      return
    }
    setCalendarError('')
    setCalendars([
      ...calendars,
      {
        id: idGenerator.generate('cal'),
        name,
        epochOffsetDays: newCalEpochOffset,
        monthsPerYear: months,
        daysPerMonth: Array.from({ length: months }, () => newCalDays),
      },
    ])
    setNewCalName('')
  }

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    const targetChap = chapters.find((c) => c.id === eventChapterId)
    const cal = calendars.find((c) => c.id === eventCalId)
    if (!targetChap || !cal) return

    const sourceExcerpt = eventSourceExcerpt.trim()
    let provenance: ChapterChronologyEvent['provenance']
    if (sourceExcerpt) {
      const sourceDocument = projectContent(
        targetChap.id,
        targetChap.content || '',
        targetChap.revision ?? 0,
      )
      const sourceRange = resolveSourceEvidenceRange(
        sourceDocument,
        { documentId: targetChap.id, excerpt: sourceExcerpt },
        true,
      )
      if (!sourceRange) {
        setEventSourceError('原文必须在关联章节当前保存版本中唯一出现。')
        return
      }

      provenance = createProvenance({
        sourceType: 'author',
        factLevel: 'canonical-fact',
        sourceDocumentId: targetChap.id,
        sourceRevision: targetChap.revision ?? 0,
        evidence: [
          {
            documentId: targetChap.id,
            excerpt: sourceDocument.text.slice(sourceRange.from, sourceRange.to),
            semanticFrom: sourceRange.from,
            semanticTo: sourceRange.to,
          },
        ],
      })
    }

    setEventSourceError(null)
    let absDay: number
    try {
      absDay = MultiCalendarEngine.toAbsoluteDay(cal, {
        year: eventYear,
        month: eventMonth,
        day: eventDay,
      })
    } catch (error) {
      setEventSourceError(error instanceof Error ? error.message : '日期无效。')
      return
    }

    const newEvent: ChapterChronologyEvent = {
      chapterId: eventChapterId,
      chapterOrder: targetChap.chapterNumber,
      chapterTitle: targetChap ? targetChap.title : '未命名章节',
      timePoint: {
        calendarId: eventCalId,
        year: eventYear,
        month: eventMonth,
        day: eventDay,
        absoluteDayIndex: absDay,
      },
      sequenceRole: eventSequenceRole,
      eventSummary: eventSummary.trim() || '主要剧情发生点',
      ...(provenance ? { provenance } : {}),
    }

    // 过滤掉同章节原事件并追加
    const updated = [...events.filter((ev) => ev.chapterId !== eventChapterId), newEvent]
    updated.sort(
      (a, b) =>
        (a.chapterOrder ?? Number.MAX_SAFE_INTEGER) - (b.chapterOrder ?? Number.MAX_SAFE_INTEGER),
    )
    setEvents(updated)
    setEventSummary('')
    setEventSourceExcerpt('')
    setEventSequenceRole('unknown')
  }

  const handleOpenChronologySource = async (event: ChapterChronologyEvent) => {
    const evidence = event.provenance?.evidence?.[0]
    if (!activeWriting || !evidence?.excerpt) {
      setChronologyNavigationMessage('当前未连接可跳转的编辑器。')
      return
    }

    const result = await activeWriting.navigateToSource({
      documentId: evidence.documentId ?? event.provenance?.sourceDocumentId ?? event.chapterId,
      sourceRevision: event.provenance?.sourceRevision,
      excerpt: evidence.excerpt,
      semanticFrom: evidence.semanticFrom,
      semanticTo: evidence.semanticTo,
    })
    setChronologyNavigationMessage(
      result.status === 'opened'
        ? result.highlighted
          ? `已定位到《${event.chapterTitle}》的原文。`
          : `已打开《${event.chapterTitle}》，但未能定位原文。`
        : result.status === 'save-blocked'
          ? '当前稿件未能保存，已取消原文跳转。'
          : result.status === 'not-found'
            ? `《${event.chapterTitle}》中的原文已变化或无法唯一匹配。`
            : '当前编辑器不可用，无法跳转原文。',
    )
  }

  const handleRemoveEvent = (chapterId: string) => {
    setEvents(events.filter((ev) => ev.chapterId !== chapterId))
  }

  const handleSaveAll = async () => {
    const updated: MultiCalendarProjectRecord = {
      id: record?.id || idGenerator.generate('calproj'),
      projectId,
      calendars,
      chronologyEvents: events,
      updatedAt: clock.now(),
    }
    await indexedDbMultiCalendarRepository.save(updated)
    setRecord(updated)
    setSavedSuccessMsg('跨历法时间轴档案已成功保存！')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  return (
    <div className="plugin-workspace-page p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarIcon className="w-6 h-6 text-indigo-500" />
            跨纪元多历法与故事时间轴引擎 (Multi-Calendar)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            设置平行历法、换算日期并检查章节时间顺序。检查结果取决于已录入的历法参数和章节日期。
          </p>
          <ScoreProvenanceBadge source="rule" detail="按历法参数换算日期并检查章节顺序" />
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          {hostContext?.aiAssistant?.isAvailable && (
            <div className="flex max-w-72 flex-col items-start gap-1">
              <button
                disabled={!chronologyScan.sampledChapterCount || aiTask.isRunning}
                onClick={handleAiChronologyScan}
                aria-describedby="multi-calendar-ai-scope"
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-[var(--ink-text)] rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                <span>AI 章节时空逆向排查</span>
              </button>
              <p
                id="multi-calendar-ai-scope"
                data-testid="multi-calendar-ai-scope"
                role="note"
                className="text-[10px] text-[var(--ink-text-faint)]"
              >
                {chronologyScan.scopeLabel}
              </p>
            </div>
          )}
          <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
          <button
            onClick={handleSaveAll}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <BookmarkCheck className="w-4 h-4" /> 保存历法时间线
          </button>
        </div>
      </div>

      {/* 历法定义：本书用几套历法、各套怎么走，只有作者能说 */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-indigo-500" />
          本书历法体系（{calendars.length} 套）
        </div>

        {calendars.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            尚未定义历法。这里不替你选：新建一本新书时是空白的，因为历法属于世界设定而不是软件默认值。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {calendars.map((c) => (
              <span
                key={c.id}
                className="px-2 py-1 rounded border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
              >
                {c.name} · {c.monthsPerYear} 月/年 · 元年偏移 {c.epochOffsetDays} 天
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end text-xs">
          <div>
            <label className="block mb-1 text-slate-500">历法名称：</label>
            <input
              type="text"
              value={newCalName}
              onChange={(e) => setNewCalName(e.target.value)}
              placeholder="例如：圣历、共和历"
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <label htmlFor="new-calendar-months" className="block mb-1 text-slate-500">
              一年月数：
            </label>
            <input
              id="new-calendar-months"
              type="number"
              min={1}
              value={newCalMonths}
              onChange={(e) => setNewCalMonths(Number(e.target.value))}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <label htmlFor="new-calendar-days" className="block mb-1 text-slate-500">
              每月天数：
            </label>
            <input
              id="new-calendar-days"
              type="number"
              min={1}
              value={newCalDays}
              onChange={(e) => setNewCalDays(Number(e.target.value))}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div className="flex gap-2">
            <input
              id="new-calendar-epoch-offset"
              aria-label="新历法元年偏移（天）"
              type="number"
              value={newCalEpochOffset}
              onChange={(e) => setNewCalEpochOffset(Number(e.target.value))}
              title="元年相对基准纪元的偏移天数"
              placeholder="元年偏移天数"
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            <button
              onClick={handleAddCalendar}
              aria-label="添加自定义历法"
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          onClick={handleApplyCalendarPreset}
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-500 transition"
        >
          套用「东方玄幻双历」预设（上古灵历 + 大炎皇统历）
        </button>
      </div>

      <p className="text-xs">
        换算按固定月长与固定年长计算，年号为连续整数（含 0 年）；闰日和闰月规则尚不支持。
      </p>
      {calendarError && <p role="alert">{calendarError}</p>}
      {/* 只对作者标记为主线推进的事件检查故事时间顺序。 */}
      {events.length === 0 ? (
        <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          尚未登记章节时间点，无法判断时间线是否一致。
        </div>
      ) : (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition ${
            chronologyAudit.status === 'conflict'
              ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              : chronologyAudit.status === 'consistent'
                ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {chronologyAudit.status === 'conflict' ? (
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            ) : chronologyAudit.status === 'consistent' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <span className="font-bold">{chronologyAudit.diagnostic}</span>
          </div>
          {chronologyAudit.status === 'conflict' && (
            <span className="font-semibold px-2 py-0.5 rounded bg-rose-500 text-white text-[11px]">
              {chronologyAudit.conflictCount} 处待核对
            </span>
          )}
        </div>
      )}

      {chronologyAudit.status === 'conflict' && (
        <div className="space-y-2" aria-label="待核对的时间顺序冲突">
          {chronologyAudit.conflictPairs.map((pair) => {
            const earlierEvent = events.find((event) => event.chapterId === pair.earlierChapterId)
            const laterEvent = events.find((event) => event.chapterId === pair.laterChapterId)

            return (
              <div
                key={`${pair.earlierChapterId}:${pair.laterChapterId}`}
                className="rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-3 text-xs space-y-2"
              >
                <p>{pair.description}</p>
                <div className="flex flex-wrap gap-2">
                  {[earlierEvent, laterEvent].filter(Boolean).map((event) => {
                    const sourceExcerpt = event?.provenance?.evidence?.[0]?.excerpt
                    return sourceExcerpt ? (
                      <button
                        key={event!.chapterId}
                        type="button"
                        disabled={!activeWriting}
                        onClick={() => void handleOpenChronologySource(event!)}
                        className="rounded border border-rose-300 dark:border-rose-800 px-2 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        打开
                        {event!.chapterOrder === null
                          ? '章节位置未知'
                          : `第 ${event!.chapterOrder} 章`}
                        原文证据
                      </button>
                    ) : (
                      <span
                        key={event!.chapterId}
                        className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-500"
                      >
                        {event!.chapterOrder === null
                          ? '章节位置未知'
                          : `第 ${event!.chapterOrder} 章`}
                        未登记可定位原文
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {chronologyNavigationMessage && <p role="status">{chronologyNavigationMessage}</p>}
        </div>
      )}

      {/* 跨历法实时对账换算器 */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <ArrowRightLeft className="w-4 h-4" />
          平行历法日期换算
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end">
          <div>
            <label className="block mb-1 text-slate-500">来源历法系统：</label>
            <Select
              aria-label="来源历法系统"
              value={sourceCalId}
              onValueChange={(v) => setSourceCalId(v)}
              className="w-full"
            >
              {calendars.length === 0 && <option value="">（尚未定义历法）</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2 grid grid-cols-3 gap-1.5">
            <div>
              <label htmlFor="source-date-year" className="block mb-1 text-slate-500">
                源日期年：
              </label>
              <input
                id="source-date-year"
                type="number"
                value={inputYear}
                onChange={(e) => setInputYear(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="source-date-month" className="block mb-1 text-slate-500">
                源日期月：
              </label>
              <input
                id="source-date-month"
                type="number"
                min={1}
                max={12}
                value={inputMonth}
                onChange={(e) => setInputMonth(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="source-date-day" className="block mb-1 text-slate-500">
                源日期日：
              </label>
              <input
                id="source-date-day"
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
            <Select
              aria-label="换算目标历法"
              value={targetCalId}
              onValueChange={(v) => setTargetCalId(v)}
              className="w-full"
            >
              {calendars.length === 0 && <option value="">（尚未定义历法）</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {/* 换算结果卡片 */}
          {conversionResult.error && <p role="alert">{conversionResult.error}</p>}
          {conversionResult.result ? (
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300">
              <div className="text-[10px] text-indigo-500">折合标量天数与对应日期：</div>
              <div className="font-bold text-xs mt-0.5">
                {conversionResult.result.targetDate.year} 年{' '}
                {conversionResult.result.targetDate.month} 月{' '}
                {conversionResult.result.targetDate.day} 日
              </div>
              <div className="text-[10px] opacity-75">
                绝对第 {conversionResult.result.absoluteDayIndex} 天
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-500">
              至少定义两套不同的历法才能换算。
            </div>
          )}
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

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block mb-1 text-slate-500">关联章节：</label>
            <Select
              aria-label="关联章节"
              value={eventChapterId}
              onValueChange={(v) => setEventChapterId(v)}
              className="w-full"
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.chapterNumber === null ? '章节位置未知' : `第 ${c.chapterNumber} 章`}：
                  {c.title}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block mb-1 text-slate-500">采用历法：</label>
            <Select
              aria-label="采用历法"
              value={eventCalId}
              onValueChange={(v) => setEventCalId(v)}
              className="w-full"
            >
              {calendars.length === 0 && <option value="">（先在上方定义历法）</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block mb-1 text-slate-500">叙述顺序：</label>
            <Select
              aria-label="叙述顺序"
              value={eventSequenceRole}
              onValueChange={(value) => setEventSequenceRole(value as ChronologySequenceRole)}
              className="w-full"
            >
              <option value="unknown">未确认（不参与自检）</option>
              <option value="mainline">主线推进（参与自检）</option>
              <option value="nonlinear">插叙 / 回忆（不参与自检）</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label htmlFor="event-date-year" className="block mb-1 text-slate-500">
                事件日期年：
              </label>
              <input
                id="event-date-year"
                type="number"
                value={eventYear}
                onChange={(e) => setEventYear(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="event-date-month" className="block mb-1 text-slate-500">
                事件日期月：
              </label>
              <input
                id="event-date-month"
                type="number"
                min={1}
                max={12}
                value={eventMonth}
                onChange={(e) => setEventMonth(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="event-date-day" className="block mb-1 text-slate-500">
                事件日期日：
              </label>
              <input
                id="event-date-day"
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
              disabled={calendars.length === 0}
              className="w-full p-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 登记时间锚点
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-slate-500" htmlFor="chronology-event-summary">
              事件简介：
            </label>
            <input
              id="chronology-event-summary"
              aria-label="事件简介"
              type="text"
              value={eventSummary}
              onChange={(e) => setEventSummary(e.target.value)}
              placeholder="例如：抵达王都"
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block mb-1 text-slate-500" htmlFor="chronology-source-excerpt">
              原文时间证据（选填）：
            </label>
            <textarea
              id="chronology-source-excerpt"
              aria-label="原文时间证据（选填）"
              rows={2}
              value={eventSourceExcerpt}
              onChange={(e) => {
                setEventSourceExcerpt(e.target.value)
                setEventSourceError(null)
              }}
              placeholder="粘贴关联章节保存版本中的原句；唯一匹配后可从冲突提示跳回。"
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            {eventSourceError && (
              <p role="alert" className="mt-1 text-rose-600 dark:text-rose-400">
                {eventSourceError}
              </p>
            )}
          </div>
        </div>
      </form>

      {/* 故事时间线节点瀑布流 */}
      <div className="space-y-2 flex-1">
        <div className="font-bold text-xs text-slate-500">
          全书编年史序列 ({events.length} 个时间节点)
        </div>
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
                  {ev.chapterOrder === null ? '章节位置未知' : `第 ${ev.chapterOrder} 章`}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {ev.chapterTitle}
                </span>
                <span className="text-slate-500">
                  {ev.sequenceRole === 'mainline'
                    ? '主线推进'
                    : ev.sequenceRole === 'nonlinear'
                      ? '插叙 / 回忆'
                      : '顺序未确认'}
                </span>
                <span className="text-slate-400">
                  【{calendars.find((c) => c.id === ev.timePoint.calendarId)?.name}】
                  {ev.timePoint.year}年{ev.timePoint.month}月{ev.timePoint.day}日 (绝对宇宙天数:{' '}
                  {ev.timePoint.absoluteDayIndex})
                </span>
              </div>

              <button
                aria-label={`从年表移除《${ev.chapterTitle}》`}
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
