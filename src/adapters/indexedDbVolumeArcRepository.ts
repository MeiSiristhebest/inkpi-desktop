import { db } from '../db/indexedDB'
import type {
  VolumeArcRecord,
  VolumeArcRepository,
} from '../ports/volumeArcRepository'

export const indexedDbVolumeArcRepository: VolumeArcRepository = {
  async getAll(projectId: string): Promise<VolumeArcRecord[]> {
    const all = await db.getAll<VolumeArcRecord>('volumeArcs')
    return all.filter((r) => r.projectId === projectId)
  },

  async getByVolumeId(projectId: string, volumeId: string): Promise<VolumeArcRecord | undefined> {
    const all = await this.getAll(projectId)
    return all.find((r) => r.volumeId === volumeId)
  },

  async save(record: VolumeArcRecord): Promise<void> {
    await db.put('volumeArcs', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('volumeArcs', id)
  },
}
