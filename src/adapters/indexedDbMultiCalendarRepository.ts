import { db } from '../db/indexedDB'
import type {
  MultiCalendarProjectRecord,
  MultiCalendarRepository,
} from '../ports/multiCalendarRepository'
import { appendAuthoritativePluginUpsert } from '../services/authoritativePluginWrite'

export const indexedDbMultiCalendarRepository: MultiCalendarRepository = {
  async get(projectId: string): Promise<MultiCalendarProjectRecord | undefined> {
    const all = await db.getAll<MultiCalendarProjectRecord>('multiCalendars')
    return all.find((r) => r.projectId === projectId)
  },

  async save(record: MultiCalendarProjectRecord): Promise<void> {
    const existing = await db.get<MultiCalendarProjectRecord>('multiCalendars', record.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'multi-calendar-project',
      aggregateId: record.id,
      workspaceId: record.projectId,
      store: 'multiCalendars',
      record,
      existing,
    })
  },
}
