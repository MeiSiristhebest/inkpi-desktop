export interface CalendarDefinition {
  id: string
  name: string // 如 "上古灵历" / "大炎皇统历"
  epochOffsetDays: number // 相对统一基准纪元（灵历 0 年）的偏移天数 (可为负数)
  monthsPerYear: number
  daysPerMonth: number[] // 各月天数
  leapRules?: string // 闰月/闰日规则
}

export interface StoryTimePoint {
  calendarId: string
  year: number
  month: number
  day: number
  absoluteDayIndex: number // 统一换算为宇宙标量天数，用于全局绝对排序与天数对账
}

export interface ChapterChronologyEvent {
  chapterId: string
  chapterOrder: number
  chapterTitle: string
  timePoint: StoryTimePoint
  eventSummary: string
}

export interface MultiCalendarProjectRecord {
  id: string // 与 projectId 对应或唯一主键
  projectId: string
  calendars: CalendarDefinition[]
  chronologyEvents: ChapterChronologyEvent[]
  updatedAt: number
}

export interface MultiCalendarRepository {
  get(projectId: string): Promise<MultiCalendarProjectRecord | undefined>
  save(record: MultiCalendarProjectRecord): Promise<void>
}
