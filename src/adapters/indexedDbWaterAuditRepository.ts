import { db } from '../db/indexedDB'
import type {
  WaterAuditSnapshot,
  WaterAuditRepository,
} from '../ports/waterAuditRepository'

export const indexedDbWaterAuditRepository: WaterAuditRepository = {
  async getAll(projectId: string): Promise<WaterAuditSnapshot[]> {
    return db.getByIndex<WaterAuditSnapshot>('waterAuditSnapshots', 'projectId', projectId)
  },

  async getByChapter(projectId: string, chapterId: string): Promise<WaterAuditSnapshot | undefined> {
    const all = await this.getAll(projectId)
    return all.find((s) => s.chapterId === chapterId)
  },

  async save(snapshot: WaterAuditSnapshot): Promise<void> {
    await db.put('waterAuditSnapshots', snapshot)
  },

  async delete(id: string): Promise<void> {
    await db.delete('waterAuditSnapshots', id)
  },
}
