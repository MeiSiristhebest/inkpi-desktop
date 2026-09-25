import { db } from '../db/indexedDB'
import type {
  ReaderSimulationRecord,
  ReaderSimulationRepository,
} from '../ports/readerSimulationRepository'

export const indexedDbReaderSimulationRepository: ReaderSimulationRepository = {
  async getAll(projectId: string): Promise<ReaderSimulationRecord[]> {
    return db.getByIndex<ReaderSimulationRecord>('readerSimulations', 'projectId', projectId)
  },

  async getByChapterId(chapterId: string): Promise<ReaderSimulationRecord | undefined> {
    const matches = await db.getByIndex<ReaderSimulationRecord>(
      'readerSimulations',
      'chapterId',
      chapterId,
    )
    return matches[0]
  },

  async save(record: ReaderSimulationRecord): Promise<void> {
    await db.put('readerSimulations', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('readerSimulations', id)
  },
}
