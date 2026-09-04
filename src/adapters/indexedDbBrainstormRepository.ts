import { db } from '../db/indexedDB'
import type {
  BrainstormSparkRecord,
  BrainstormRepository,
} from '../ports/brainstormRepository'

export const indexedDbBrainstormRepository: BrainstormRepository = {
  async getAll(projectId: string): Promise<BrainstormSparkRecord[]> {
    const all = await db.getAll<BrainstormSparkRecord>('brainstormSparks')
    return all.filter((r) => r.projectId === projectId)
  },

  async get(id: string): Promise<BrainstormSparkRecord | undefined> {
    return await db.get<BrainstormSparkRecord>('brainstormSparks', id)
  },

  async save(record: BrainstormSparkRecord): Promise<void> {
    await db.put('brainstormSparks', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('brainstormSparks', id)
  },
}
