import { db } from '../db/indexedDB'
import type {
  FactionDiplomacyRecord,
  FactionDiplomacyRepository,
} from '../ports/factionDiplomacyRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export const indexedDbFactionDiplomacyRepository: FactionDiplomacyRepository = {
  async getAll(projectId: string): Promise<FactionDiplomacyRecord[]> {
    return db.getByIndex<FactionDiplomacyRecord>('factionDiplomacies', 'projectId', projectId)
  },

  async save(record: FactionDiplomacyRecord): Promise<void> {
    const existing = await db.get<FactionDiplomacyRecord>('factionDiplomacies', record.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'faction-diplomacy',
      aggregateId: record.id,
      workspaceId: record.projectId,
      store: 'factionDiplomacies',
      record,
      existing,
    })
  },

  async delete(id: string): Promise<void> {
    const existing = await db.get<FactionDiplomacyRecord>('factionDiplomacies', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'faction-diplomacy',
      aggregateId: id,
      store: 'factionDiplomacies',
      existing,
    })
  },
}
