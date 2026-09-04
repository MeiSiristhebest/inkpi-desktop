import { db } from '../db/indexedDB'
import type {
  MemoryPalaceSnapshotRecord,
  MemoryPalaceRepository,
} from '../ports/memoryPalaceRepository'

export const indexedDbMemoryPalaceRepository: MemoryPalaceRepository = {
  async getAll(projectId: string): Promise<MemoryPalaceSnapshotRecord[]> {
    const all = await db.getAll<MemoryPalaceSnapshotRecord>('memoryPalaceSnapshots')
    return all.filter((r) => r.projectId === projectId)
  },

  async getByEntityId(entityId: string): Promise<MemoryPalaceSnapshotRecord | undefined> {
    const all = await db.getAll<MemoryPalaceSnapshotRecord>('memoryPalaceSnapshots')
    return all.find((r) => r.entityId === entityId)
  },

  async save(record: MemoryPalaceSnapshotRecord): Promise<void> {
    await db.put('memoryPalaceSnapshots', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('memoryPalaceSnapshots', id)
  },
}
