import { db } from "../db/indexedDB"
import type {
  AftermathPatchRecord,
  AftermathRepository,
} from "../ports/aftermathRepository"

export const indexedDbAftermathRepository: AftermathRepository = {
  async getAll(projectId: string): Promise<AftermathPatchRecord[]> {
    const all = await db.getAll<AftermathPatchRecord>("aftermathPatches")
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapter(chapterId: string): Promise<AftermathPatchRecord[]> {
    const all = await db.getAll<AftermathPatchRecord>("aftermathPatches")
    return all.filter((r) => r.chapterId === chapterId)
  },

  async get(id: string): Promise<AftermathPatchRecord | undefined> {
    return await db.get<AftermathPatchRecord>("aftermathPatches", id)
  },

  async save(record: AftermathPatchRecord): Promise<void> {
    await db.put("aftermathPatches", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("aftermathPatches", id)
  },
}
