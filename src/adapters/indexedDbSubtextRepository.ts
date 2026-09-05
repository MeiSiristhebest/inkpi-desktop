import { db } from "../db/indexedDB"
import type {
  SubtextDialogueRecord,
  SubtextRepository,
} from "../ports/subtextRepository"

export const indexedDbSubtextRepository: SubtextRepository = {
  async getAll(projectId: string): Promise<SubtextDialogueRecord[]> {
    return db.getByIndex<SubtextDialogueRecord>("subtextDialogues", 'projectId', projectId)
  },

  async getByChapter(chapterId: string): Promise<SubtextDialogueRecord[]> {
    return db.getByIndex<SubtextDialogueRecord>("subtextDialogues", 'chapterId', chapterId)
  },

  async get(id: string): Promise<SubtextDialogueRecord | undefined> {
    return await db.get<SubtextDialogueRecord>("subtextDialogues", id)
  },

  async save(record: SubtextDialogueRecord): Promise<void> {
    await db.put("subtextDialogues", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("subtextDialogues", id)
  },
}
