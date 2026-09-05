import { db } from "../db/indexedDB"
import type {
  GoldChapterEvalRecord,
  GoldChaptersRepository,
} from "../ports/goldChaptersRepository"

export const indexedDbGoldChaptersRepository: GoldChaptersRepository = {
  async getAll(projectId: string): Promise<GoldChapterEvalRecord[]> {
    return db.getByIndex<GoldChapterEvalRecord>("goldChapterEvals", 'projectId', projectId)
  },

  async get(id: string): Promise<GoldChapterEvalRecord | undefined> {
    return await db.get<GoldChapterEvalRecord>("goldChapterEvals", id)
  },

  async save(record: GoldChapterEvalRecord): Promise<void> {
    await db.put("goldChapterEvals", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("goldChapterEvals", id)
  },
}
