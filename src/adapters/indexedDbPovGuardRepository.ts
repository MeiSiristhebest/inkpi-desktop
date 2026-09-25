import { db } from '../db/indexedDB'
import type { PovSnapshotRecord, PovGuardRepository } from '../ports/povGuardRepository'

export const indexedDbPovGuardRepository: PovGuardRepository = {
  async getAll(projectId: string): Promise<PovSnapshotRecord[]> {
    return db.getByIndex<PovSnapshotRecord>('povSnapshots', 'projectId', projectId)
  },

  async getByChapter(chapterId: string): Promise<PovSnapshotRecord | undefined> {
    const matches = await db.getByIndex<PovSnapshotRecord>('povSnapshots', 'chapterId', chapterId)
    return matches[0]
  },

  async get(id: string): Promise<PovSnapshotRecord | undefined> {
    return await db.get<PovSnapshotRecord>('povSnapshots', id)
  },

  async save(record: PovSnapshotRecord): Promise<void> {
    await db.put('povSnapshots', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('povSnapshots', id)
  },
}
