import { db } from '../db/indexedDB'
import type {
  MemoryPalaceSnapshotRecord,
  MemoryPalaceRepository,
} from '../ports/memoryPalaceRepository'

export const indexedDbMemoryPalaceRepository: MemoryPalaceRepository = {
  async getAll(projectId: string): Promise<MemoryPalaceSnapshotRecord[]> {
    return db.getByIndex<MemoryPalaceSnapshotRecord>(
      'memoryPalaceSnapshots',
      'projectId',
      projectId,
    )
  },

  async getByEntityId(entityId: string): Promise<MemoryPalaceSnapshotRecord | undefined> {
    const matches = await db.getByIndex<MemoryPalaceSnapshotRecord>(
      'memoryPalaceSnapshots',
      'entityId',
      entityId,
    )
    return matches[0]
  },

  async save(record: MemoryPalaceSnapshotRecord): Promise<void> {
    await db.put('memoryPalaceSnapshots', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('memoryPalaceSnapshots', id)
  },
}
