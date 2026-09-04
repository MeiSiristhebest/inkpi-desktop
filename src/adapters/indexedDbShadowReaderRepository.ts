import { db } from "../db/indexedDB"
import type {
  ShadowDanmakuRecord,
  ShadowReaderRepository,
} from "../ports/shadowReaderRepository"

export const indexedDbShadowReaderRepository: ShadowReaderRepository = {
  async getAll(projectId: string): Promise<ShadowDanmakuRecord[]> {
    const all = await db.getAll<ShadowDanmakuRecord>("shadowDanmakus")
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapter(chapterId: string): Promise<ShadowDanmakuRecord[]> {
    const all = await db.getAll<ShadowDanmakuRecord>("shadowDanmakus")
    return all.filter((r) => r.chapterId === chapterId)
  },

  async save(record: ShadowDanmakuRecord): Promise<void> {
    await db.put("shadowDanmakus", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("shadowDanmakus", id)
  },
}
