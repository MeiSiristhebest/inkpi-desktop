import type {
  CalendarDefinition,
  StoryTimePoint,
  ChronologySequenceRole,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  MultiCalendarRepository,
} from '../../ports/multiCalendarRepository'

export type {
  CalendarDefinition,
  StoryTimePoint,
  ChronologySequenceRole,
  ChapterChronologyEvent,
  MultiCalendarProjectRecord,
  MultiCalendarRepository,
}

export interface ChronologyAuditResult {
  status: 'insufficient-data' | 'consistent' | 'conflict'
  hasConflict: boolean
  conflictCount: number
  checkedEventCount: number
  excludedEventCount: number
  conflictPairs: Array<{
    earlierChapterId: string
    laterChapterId: string
    earlierChapterOrder: number
    laterChapterOrder: number
    earlierDayIndex: number
    laterDayIndex: number
    description: string
  }>
  diagnostic: string
}
