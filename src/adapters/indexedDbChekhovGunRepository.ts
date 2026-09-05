import { db } from '../db/indexedDB'
import type {
  ChekhovGunRecord,
  ChekhovGunRepository,
} from '../ports/chekhovGunRepository'

export const indexedDbChekhovGunRepository: ChekhovGunRepository = {
  async getAll(projectId: string): Promise<ChekhovGunRecord[]> {
    return db.getByIndex<ChekhovGunRecord>('chekhovGuns', 'projectId', projectId)
  },

  async get(id: string): Promise<ChekhovGunRecord | undefined> {
    return await db.get<ChekhovGunRecord>('chekhovGuns', id)
  },

  async save(record: ChekhovGunRecord): Promise<void> {
    await db.put('chekhovGuns', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('chekhovGuns', id)
  },
}
