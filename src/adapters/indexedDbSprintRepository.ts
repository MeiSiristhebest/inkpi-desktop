import { db } from '../db/indexedDB'
import type {
  SprintRecord,
  SprintRepository,
} from '../ports/sprintRepository'

export const indexedDbSprintRepository: SprintRepository = {
  async getAll(): Promise<SprintRecord[]> {
    return db.getAll<SprintRecord>('sprintRecords')
  },
  async save(record: SprintRecord): Promise<void> {
    await db.put('sprintRecords', record)
  },
  async delete(id: string): Promise<void> {
    await db.delete('sprintRecords', id)
  },
}
