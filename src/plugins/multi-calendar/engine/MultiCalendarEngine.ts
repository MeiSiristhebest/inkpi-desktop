import type { CalendarDefinition, ChapterChronologyEvent, ChronologyAuditResult } from '../types'

export class MultiCalendarEngine {
  /** Fixed-length years only. Integer years are continuous and include year zero. */
  static validateCalendar(calendar: CalendarDefinition): number {
    if (calendar.leapRules?.trim())
      throw new RangeError('尚不支持闰日或闰月规则，不能按固定年换算。')
    if (
      !Number.isSafeInteger(calendar.epochOffsetDays) ||
      !Number.isSafeInteger(calendar.monthsPerYear) ||
      calendar.monthsPerYear < 1 ||
      calendar.daysPerMonth.length !== calendar.monthsPerYear ||
      calendar.daysPerMonth.some((days) => !Number.isSafeInteger(days) || days < 1)
    ) {
      throw new RangeError('历法需要整数纪元偏移和完整、正整数的月长。')
    }
    const daysInYear = calendar.daysPerMonth.reduce((a, b) => a + b, 0)
    if (!Number.isSafeInteger(daysInYear)) throw new RangeError('年长超出可精确计算范围。')
    return daysInYear
  }
  /**
   * 东方玄幻流派的历法预设（上古灵历 + 大炎皇统历）。
   *
   * §P2.4：它是「流派预设」，不是「默认值」——只有作者显式点套用才允许进入本书档案。
   * 曾经它被当成缺省历法直接写进每个新工作区，等于替所有书选定了仙侠纪元。
   */
  static readonly GENRE_PRESET_CALENDARS: CalendarDefinition[] = [
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
    date: { year: number; month: number; day: number },
  ): number {
    const daysInYear = this.validateCalendar(calendar)
    if (
      !Number.isSafeInteger(date.year) ||
      !Number.isSafeInteger(date.month) ||
      !Number.isSafeInteger(date.day) ||
      date.month < 1 ||
      date.month > calendar.monthsPerYear ||
      date.day < 1 ||
      date.day > calendar.daysPerMonth[date.month - 1]
    ) {
      throw new RangeError('日期不存在：请检查整数年、月及该月的天数。')
    }
    let total = calendar.epochOffsetDays + (date.year - 1) * daysInYear

    // 累加当年前面月份的天数
    for (let m = 1; m < date.month && m <= calendar.monthsPerYear; m++) {
      total += calendar.daysPerMonth[m - 1]
    }

    // 累加当月日数
    total += date.day - 1
    if (!Number.isSafeInteger(total)) throw new RangeError('日期超出可精确计算范围。')
    return total
  }

  /**
   * 将全宇宙绝对天数标量逆向反解回指定历法的 年/月/日
   */
  static fromAbsoluteDay(
    calendar: CalendarDefinition,
    absoluteDay: number,
  ): { year: number; month: number; day: number } {
    const daysInYear = this.validateCalendar(calendar)
    if (
      !Number.isSafeInteger(absoluteDay) ||
      !Number.isSafeInteger(absoluteDay - calendar.epochOffsetDays)
    )
      throw new RangeError('绝对天数需要在安全整数范围内。')
    let dayRemainder = absoluteDay - calendar.epochOffsetDays

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
   * Compare only events the author explicitly marked as part of the mainline.
   * Chapter order alone does not establish story-time order.
   */
  static validateChronology(events: ChapterChronologyEvent[]): ChronologyAuditResult {
    const mainlineEvents = events
      .filter((event) => event.sequenceRole === 'mainline')
      .sort((a, b) => a.chapterOrder - b.chapterOrder)
    const excludedEventCount = events.length - mainlineEvents.length

    if (mainlineEvents.length < 2) {
      return {
        status: 'insufficient-data',
        hasConflict: false,
        conflictCount: 0,
        checkedEventCount: mainlineEvents.length,
        excludedEventCount,
        conflictPairs: [],
        diagnostic:
          mainlineEvents.length === 0
            ? `有 ${events.length} 个时间节点，但没有作者标记为主线推进；无法判断时间线是否一致。`
            : `只有 ${mainlineEvents.length} 个主线推进节点；至少需要两个节点才能检查顺序。`,
      }
    }

    const conflictPairs: ChronologyAuditResult['conflictPairs'] = []

    for (let i = 0; i < mainlineEvents.length - 1; i++) {
      const current = mainlineEvents[i]
      const next = mainlineEvents[i + 1]

      // A regression among explicitly marked mainline events is a review signal,
      // not proof of a story error. Flashbacks and unclassified events are excluded.
      if (next.timePoint.absoluteDayIndex < current.timePoint.absoluteDayIndex) {
        const gap = current.timePoint.absoluteDayIndex - next.timePoint.absoluteDayIndex
        conflictPairs.push({
          earlierChapterId: current.chapterId,
          laterChapterId: next.chapterId,
          earlierChapterOrder: current.chapterOrder,
          laterChapterOrder: next.chapterOrder,
          earlierDayIndex: current.timePoint.absoluteDayIndex,
          laterDayIndex: next.timePoint.absoluteDayIndex,
          description: `第 ${next.chapterOrder} 章《${next.chapterTitle}》的主线时间比第 ${current.chapterOrder} 章早 ${gap} 天，请对照原文确认。`,
        })
      }
    }

    const hasConflict = conflictPairs.length > 0
    return {
      status: hasConflict ? 'conflict' : 'consistent',
      hasConflict,
      conflictCount: conflictPairs.length,
      checkedEventCount: mainlineEvents.length,
      excludedEventCount,
      conflictPairs,
      diagnostic: hasConflict
        ? `主线顺序与故事时间有 ${conflictPairs.length} 处不一致；请对照原文确认，非线性叙述不会自动判为错误。`
        : `已比较 ${mainlineEvents.length} 个主线推进节点，未发现顺序冲突。${excludedEventCount > 0 ? `另有 ${excludedEventCount} 个非主线或顺序未确认的节点未参与检查。` : ''}`,
    }
  }
}
