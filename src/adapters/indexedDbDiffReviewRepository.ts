import { db } from "../db/indexedDB"
import type {
  DiffReviewRecord,
  DiffReviewRepository,
} from "../ports/diffReviewRepository"

export const indexedDbDiffReviewRepository: DiffReviewRepository = {
  async getAll(projectId: string): Promise<DiffReviewRecord[]> {
    return db.getByIndex<DiffReviewRecord>("diffReviews", 'projectId', projectId)
  },

  async get(id: string): Promise<DiffReviewRecord | undefined> {
    return await db.get<DiffReviewRecord>("diffReviews", id)
  },

  async getByChapter(chapterId: string): Promise<DiffReviewRecord[]> {
    return db.getByIndex<DiffReviewRecord>("diffReviews", 'chapterId', chapterId)
  },

  async save(record: DiffReviewRecord): Promise<void> {
    await db.put("diffReviews", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("diffReviews", id)
  },
}
