import { db } from '../db/indexedDB'
import type { MultiCalendarProjectRecord } from '../ports/multiCalendarRepository'
import { indexedDbMultiCalendarRepository } from './indexedDbMultiCalendarRepository'
import { describe, expect, it } from 'vitest'

describe('indexedDbMultiCalendarRepository', () => {
  it('round-trips chronology roles and source evidence through IndexedDB', async () => {
    const projectId = `multi-calendar-round-trip-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const event = {
      chapterId: 'chapter-1',
      chapterOrder: 2,
      chapterTitle: '王都来信',
      sequenceRole: 'mainline' as const,
      timePoint: {
        calendarId: 'imperial',
        year: 8,
        month: 3,
        day: 2,
        absoluteDayIndex: 42,
      },
      eventSummary: '守城人敲响晨钟。',
      provenance: {
        sourceType: 'author' as const,
        factLevel: 'canonical-fact' as const,
        sourceDocumentId: 'chapter-1',
        sourceRevision: 7,
        evidence: [
          {
            documentId: 'chapter-1',
            excerpt: '守城人敲响晨钟。',
            semanticFrom: 4,
            semanticTo: 13,
          },
        ],
      },
    }
    const record: MultiCalendarProjectRecord = {
      id: projectId,
      projectId,
      calendars: [
        { id: 'imperial', name: '皇历', epochOffsetDays: 0, monthsPerYear: 12, daysPerMonth: [] },
      ],
      chronologyEvents: [event],
      updatedAt: 1,
    }

    try {
      await indexedDbMultiCalendarRepository.save(record)

      const reloaded = await indexedDbMultiCalendarRepository.get(projectId)

      expect(reloaded?.chronologyEvents).toEqual([event])
      expect(reloaded?.chronologyEvents[0]).toMatchObject({
        sequenceRole: 'mainline',
        provenance: {
          sourceDocumentId: 'chapter-1',
          sourceRevision: 7,
          evidence: [
            {
              excerpt: '守城人敲响晨钟。',
              semanticFrom: 4,
              semanticTo: 13,
            },
          ],
        },
      })
    } finally {
      await db.delete('multiCalendars', projectId)
      await db.delete('settingsKV', `storyState::${encodeURIComponent(projectId)}`)
      const changeSets = await db.getAll<{ id: string; workspaceId: string }>('domainChangeSets')
      await Promise.all(
        changeSets
          .filter((changeSet) => changeSet.workspaceId === projectId)
          .map((changeSet) => db.delete('domainChangeSets', changeSet.id)),
      )
    }
  })
})
