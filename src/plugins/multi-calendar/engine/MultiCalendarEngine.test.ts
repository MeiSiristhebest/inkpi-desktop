import { describe, it, expect } from 'vitest'
import { MultiCalendarEngine } from './MultiCalendarEngine'

describe('MultiCalendarEngine', () => {
  const [calAncient, calDynasty] = MultiCalendarEngine.GENRE_PRESET_CALENDARS

  it('accurately converts date to absolute day and back', () => {
    // 灵历 10 年 3 月 15 日
    const date = { year: 10, month: 3, day: 15 }
    const absDay = MultiCalendarEngine.toAbsoluteDay(calAncient, date)

    // 反解
    const restored = MultiCalendarEngine.fromAbsoluteDay(calAncient, absDay)
    expect(restored).toEqual(date)
  })

  it('converts date across two parallel calendars', () => {
    // 灵历 1001 年 1 月 1 日 -> 大炎皇统历 2 年 1 月 1 日 (大炎开国于 1000 年，360000天偏移)
    const res = MultiCalendarEngine.convertCalendarDate({
      sourceCalendar: calAncient,
      targetCalendar: calDynasty,
      sourceDate: { year: 1001, month: 1, day: 1 },
    })

    expect(res.absoluteDayIndex).toBe(360000)
    expect(res.targetDate.year).toBe(1)
  })

  it('reports a reviewable conflict between explicitly marked mainline events', () => {
    const events = [
      {
        chapterId: 'ch1',
        chapterOrder: 1,
        chapterTitle: '离开新手村',
        sequenceRole: 'mainline' as const,
        timePoint: {
          calendarId: 'cal_ancient',
          year: 100,
          month: 1,
          day: 1,
          absoluteDayIndex: 10000,
        },
        eventSummary: '启程',
      },
      {
        chapterId: 'ch2',
        chapterOrder: 2,
        chapterTitle: '抵达皇城',
        sequenceRole: 'mainline' as const,
        timePoint: {
          calendarId: 'cal_ancient',
          year: 99,
          month: 5,
          day: 1,
          absoluteDayIndex: 9000,
        },
        eventSummary: '入城',
      },
    ]

    const report = MultiCalendarEngine.validateChronology(events)
    expect(report.status).toBe('conflict')
    expect(report.hasConflict).toBe(true)
    expect(report.conflictCount).toBe(1)
    expect(report.conflictPairs[0].earlierChapterId).toBe('ch1')
    expect(report.conflictPairs[0].laterChapterId).toBe('ch2')
    expect(report.conflictPairs[0].description).toContain('早 1000 天')
  })

  it('does not infer sequence from legacy events or non-linear events', () => {
    const report = MultiCalendarEngine.validateChronology([
      {
        chapterId: 'ch1',
        chapterOrder: 1,
        chapterTitle: '现在',
        timePoint: {
          calendarId: 'cal_ancient',
          year: 100,
          month: 1,
          day: 1,
          absoluteDayIndex: 10000,
        },
        eventSummary: '当前事件',
      },
      {
        chapterId: 'ch2',
        chapterOrder: 2,
        chapterTitle: '回忆',
        sequenceRole: 'nonlinear',
        timePoint: {
          calendarId: 'cal_ancient',
          year: 99,
          month: 5,
          day: 1,
          absoluteDayIndex: 9000,
        },
        eventSummary: '回忆事件',
      },
    ])

    expect(report.status).toBe('insufficient-data')
    expect(report.hasConflict).toBe(false)
    expect(report.checkedEventCount).toBe(0)
    expect(report.excludedEventCount).toBe(2)
    expect(report.diagnostic).toContain('无法判断')
  })

  it('ignores marked nonlinear events when comparing mainline dates', () => {
    const base = {
      timePoint: {
        calendarId: 'cal_ancient',
        year: 100,
        month: 1,
        day: 1,
        absoluteDayIndex: 10000,
      },
      eventSummary: '事件',
    }
    const report = MultiCalendarEngine.validateChronology([
      {
        ...base,
        chapterId: 'ch1',
        chapterOrder: 1,
        chapterTitle: '主线一',
        sequenceRole: 'mainline' as const,
      },
      {
        ...base,
        chapterId: 'ch2',
        chapterOrder: 2,
        chapterTitle: '插叙',
        sequenceRole: 'nonlinear' as const,
        timePoint: { ...base.timePoint, absoluteDayIndex: 8000 },
      },
      {
        ...base,
        chapterId: 'ch3',
        chapterOrder: 3,
        chapterTitle: '主线二',
        sequenceRole: 'mainline' as const,
        timePoint: { ...base.timePoint, absoluteDayIndex: 11000 },
      },
    ])

    expect(report.status).toBe('consistent')
    expect(report.checkedEventCount).toBe(2)
    expect(report.excludedEventCount).toBe(1)
  })

  it('handles negative/BC absolute days without NaN or crash', () => {
    // 纪元前 -360 天
    const date = MultiCalendarEngine.fromAbsoluteDay(calAncient, -360)
    expect(Number.isInteger(date.year)).toBe(true)
    expect(Number.isInteger(date.month)).toBe(true)
    expect(Number.isInteger(date.day)).toBe(true)
    expect(date.month).toBeGreaterThanOrEqual(1)
    expect(date.day).toBeGreaterThanOrEqual(1)
  })
})
