import { db } from "../db/indexedDB"
import type {
  SubtextDialogueRecord,
  SubtextRepository,
} from "../ports/subtextRepository"

export const indexedDbSubtextRepository: SubtextRepository = {
  async getAll(projectId: string): Promise<SubtextDialogueRecord[]> {
    const all = await db.getAll<SubtextDialogueRecord>("subtextDialogues")
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapter(chapterId: string): Promise<SubtextDialogueRecord[]> {
    const all = await db.getAll<SubtextDialogueRecord>("subtextDialogues")
    return all.filter((r) => r.chapterId === chapterId)
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
