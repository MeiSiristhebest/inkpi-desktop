import { db } from '../db/indexedDB'
import type {
  EmotionAuditRecord,
  EmotionAuditRepository,
} from '../ports/emotionAuditRepository'

export const indexedDbEmotionAuditRepository: EmotionAuditRepository = {
  async getAll(projectId: string): Promise<EmotionAuditRecord[]> {
    return db.getByIndex<EmotionAuditRecord>('emotionAudits', 'projectId', projectId)
  },

  async getByChapterId(chapterId: string): Promise<EmotionAuditRecord | undefined> {
    const all = await db.getAll<EmotionAuditRecord>('emotionAudits')
    return all.find((r) => r.chapterId === chapterId)
  },

  async save(record: EmotionAuditRecord): Promise<void> {
    await db.put('emotionAudits', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('emotionAudits', id)
  },
}
