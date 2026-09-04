import { db } from '../db/indexedDB'
import type { MultiCalendarProjectRecord, MultiCalendarRepository } from '../ports/multiCalendarRepository'

export const indexedDbMultiCalendarRepository: MultiCalendarRepository = {
  async get(projectId: string): Promise<MultiCalendarProjectRecord | undefined> {
    const all = await db.getAll<MultiCalendarProjectRecord>('multiCalendars')
    return all.find((r) => r.projectId === projectId)
  },

  async save(record: MultiCalendarProjectRecord): Promise<void> {
    await db.put('multiCalendars', record)
  },
}
