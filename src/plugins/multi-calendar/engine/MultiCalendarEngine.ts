import type {
  CalendarDefinition,
  ChapterChronologyEvent,
  ChronologyAuditResult,
} from '../types'

export class MultiCalendarEngine {
  /**
   * 默认内置两套经典并行历法系统
   */
  static readonly DEFAULT_CALENDARS: CalendarDefinition[] = [
    {
      id: 'cal_ancient',
      name: '上古灵历',
      epochOffsetDays: 0, // 基准元年
      monthsPerYear: 12,
      daysPerMonth: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // 仙家一律360日/年
    },
    {
      id: 'cal_dynasty',
      name: '大炎皇统历',
      epochOffsetDays: 360000, // 灵历 1000 年大炎开国
      monthsPerYear: 12,
      daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    },
  ]

  /**
   * 将特定历法的 年/月/日 统一转换为全宇宙绝对天数标量 (Universal Absolute Day)
   */
  static toAbsoluteDay(
    calendar: CalendarDefinition,
    date: { year: number; month: number; day: number }
  ): number {
    const daysInYear = calendar.daysPerMonth.reduce((a, b) => a + b, 0)
    let total = calendar.epochOffsetDays + (date.year - 1) * daysInYear

    // 累加当年前面月份的天数
    for (let m = 1; m < date.month && m <= calendar.monthsPerYear; m++) {
      total += calendar.daysPerMonth[m - 1] || 30
    }

    // 累加当月日数
    total += Math.max(0, date.day - 1)
    return total
  }

  /**
   * 将全宇宙绝对天数标量逆向反解回指定历法的 年/月/日
   */
  static fromAbsoluteDay(
    calendar: CalendarDefinition,
    absoluteDay: number
  ): { year: number; month: number; day: number } {
    let dayRemainder = absoluteDay - calendar.epochOffsetDays
    const daysInYear = calendar.daysPerMonth.reduce((a, b) => a + b, 0)

    let year = 1
    if (dayRemainder >= 0) {
      year = Math.floor(dayRemainder / daysInYear) + 1
      dayRemainder = dayRemainder % daysInYear
    } else {
      // 纪元前 (负天数)
      year = Math.floor(dayRemainder / daysInYear) + 1
      dayRemainder = ((dayRemainder % daysInYear) + daysInYear) % daysInYear
    }

    let month = 1
    for (let m = 0; m < calendar.daysPerMonth.length; m++) {
      const mDays = calendar.daysPerMonth[m]
      if (dayRemainder < mDays) {
        month = m + 1
        break
      }
      dayRemainder -= mDays
    }

    const day = dayRemainder + 1
    return { year, month, day }
  }

  /**
   * 跨历法换算：将 Calendar A 的日期转换为 Calendar B 的日期
   */
  static convertCalendarDate(params: {
    sourceCalendar: CalendarDefinition
    targetCalendar: CalendarDefinition
    sourceDate: { year: number; month: number; day: number }
  }): {
    targetDate: { year: number; month: number; day: number }
    absoluteDayIndex: number
  } {
    const { sourceCalendar, targetCalendar, sourceDate } = params
    const absDay = this.toAbsoluteDay(sourceCalendar, sourceDate)
    const targetDate = this.fromAbsoluteDay(targetCalendar, absDay)
    return {
      targetDate,
      absoluteDayIndex: absDay,
    }
  }

  /**
   * 故事时间轴时间单调性与时间倒流悖论巡检
   */
  static validateChronology(events: ChapterChronologyEvent[]): ChronologyAuditResult {
    if (events.length <= 1) {
      return {
        hasParadox: false,
        paradoxCount: 0,
        conflictPairs: [],
        diagnostic: '时间线节点单调平稳，无逻辑倒流。',
      }
    }

    const sortedByChapter = [...events].sort((a, b) => a.chapterOrder - b.chapterOrder)
    const conflictPairs: ChronologyAuditResult['conflictPairs'] = []

    for (let i = 0; i < sortedByChapter.length - 1; i++) {
      const current = sortedByChapter[i]
      const next = sortedByChapter[i + 1]

      // 若后续章节对应的宇宙绝对天数比前文还小，说明发生了时间倒流！
      if (next.timePoint.absoluteDayIndex < current.timePoint.absoluteDayIndex) {
        const gap = current.timePoint.absoluteDayIndex - next.timePoint.absoluteDayIndex
        conflictPairs.push({
          earlierChapterOrder: current.chapterOrder,
          laterChapterOrder: next.chapterOrder,
          earlierDayIndex: current.timePoint.absoluteDayIndex,
          laterDayIndex: next.timePoint.absoluteDayIndex,
          description: `第 ${next.chapterOrder} 章 (${next.chapterTitle}) 的历法绝对时间比第 ${current.chapterOrder} 章倒流了 ${gap} 天！`,
        })
      }
    }

    const hasParadox = conflictPairs.length > 0
    return {
      hasParadox,
      paradoxCount: conflictPairs.length,
      conflictPairs,
      diagnostic: hasParadox
        ? `🚨 发现 ${conflictPairs.length} 处严重时间倒流悖论！后文章节发生的时间早于前文已发生事件！`
        : '时间单调性检验合格，全书编年史因果流动严密。',
    }
  }
}
