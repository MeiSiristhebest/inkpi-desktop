import { db } from '../db/indexedDB'
import type {
  ReaderSimulationRecord,
  ReaderSimulationRepository,
} from '../ports/readerSimulationRepository'

export const indexedDbReaderSimulationRepository: ReaderSimulationRepository = {
  async getAll(projectId: string): Promise<ReaderSimulationRecord[]> {
    const all = await db.getAll<ReaderSimulationRecord>('readerSimulations')
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapterId(chapterId: string): Promise<ReaderSimulationRecord | undefined> {
    const all = await db.getAll<ReaderSimulationRecord>('readerSimulations')
    return all.find((r) => r.chapterId === chapterId)
  },

  async save(record: ReaderSimulationRecord): Promise<void> {
    await db.put('readerSimulations', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('readerSimulations', id)
  },
}
