import { db } from "../db/indexedDB"
import type {
  ShadowDanmakuRecord,
  ShadowReaderRepository,
} from "../ports/shadowReaderRepository"

export const indexedDbShadowReaderRepository: ShadowReaderRepository = {
  async getAll(projectId: string): Promise<ShadowDanmakuRecord[]> {
    return db.getByIndex<ShadowDanmakuRecord>("shadowDanmakus", 'projectId', projectId)
  },

  async getByChapter(chapterId: string): Promise<ShadowDanmakuRecord[]> {
    return db.getByIndex<ShadowDanmakuRecord>("shadowDanmakus", 'chapterId', chapterId)
  },

  async save(record: ShadowDanmakuRecord): Promise<void> {
    await db.put("shadowDanmakus", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("shadowDanmakus", id)
  },
}
