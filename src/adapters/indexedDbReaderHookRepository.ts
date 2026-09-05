import { db } from '../db/indexedDB'
import type {
  ReaderHookRecord,
  ReaderHookRepository,
} from '../ports/readerHookRepository'

export const indexedDbReaderHookRepository: ReaderHookRepository = {
  async getAll(projectId?: string): Promise<ReaderHookRecord[]> {
    if (projectId) {
      return db.getByIndex<ReaderHookRecord>('readerHooks', 'projectId', projectId)
    }
    return db.getAll<ReaderHookRecord>('readerHooks')
  },
  async save(record: ReaderHookRecord): Promise<void> {
    await db.put('readerHooks', record)
  },
  async delete(id: string): Promise<void> {
    await db.delete('readerHooks', id)
  },
}
