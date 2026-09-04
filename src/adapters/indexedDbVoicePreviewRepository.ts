import { db } from "../db/indexedDB"
import type {
  VoiceCastProfileRecord,
  VoicePreviewRepository,
} from "../ports/voicePreviewRepository"

export const indexedDbVoicePreviewRepository: VoicePreviewRepository = {
  async getAll(projectId: string): Promise<VoiceCastProfileRecord[]> {
    const all = await db.getAll<VoiceCastProfileRecord>("voiceScriptCasts")
    return all.filter((r) => r.projectId === projectId)
  },

  async get(id: string): Promise<VoiceCastProfileRecord | undefined> {
    return await db.get<VoiceCastProfileRecord>("voiceScriptCasts", id)
  },

  async save(record: VoiceCastProfileRecord): Promise<void> {
    await db.put("voiceScriptCasts", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("voiceScriptCasts", id)
  },
}

