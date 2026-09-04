import type {
  CalendarDefinition,
  StoryTimePoint,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  MultiCalendarRepository,
} from '../../ports/multiCalendarRepository'

export type {
  CalendarDefinition,
  StoryTimePoint,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  MultiCalendarRepository,
}

export interface ChronologyAuditResult {
  hasParadox: boolean
  paradoxCount: number
  conflictPairs: Array<{
    earlierChapterOrder: number
    laterChapterOrder: number
    earlierDayIndex: number
    laterDayIndex: number
    description: string
  }>
  diagnostic: string
}
