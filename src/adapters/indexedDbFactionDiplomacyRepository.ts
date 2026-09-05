import { db } from '../db/indexedDB'
import type {
  FactionDiplomacyRecord,
  FactionDiplomacyRepository,
} from '../ports/factionDiplomacyRepository'

export const indexedDbFactionDiplomacyRepository: FactionDiplomacyRepository = {
  async getAll(projectId: string): Promise<FactionDiplomacyRecord[]> {
    return db.getByIndex<FactionDiplomacyRecord>('factionDiplomacies', 'projectId', projectId)
  },

  async save(record: FactionDiplomacyRecord): Promise<void> {
    await db.put('factionDiplomacies', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('factionDiplomacies', id)
  },
}
