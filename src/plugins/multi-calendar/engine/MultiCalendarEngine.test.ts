import { describe, it, expect } from 'vitest'
import { MultiCalendarEngine } from './MultiCalendarEngine'

describe('MultiCalendarEngine', () => {
  const [calAncient, calDynasty] = MultiCalendarEngine.DEFAULT_CALENDARS

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

  it('detects timeline paradox when chronological sequence goes backwards', () => {
    const events = [
      {
        chapterId: 'ch1',
        chapterOrder: 1,
        chapterTitle: '离开新手村',
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
    expect(report.hasParadox).toBe(true)
    expect(report.paradoxCount).toBe(1)
    expect(report.conflictPairs[0].description).toContain('倒流了 1000 天')
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
