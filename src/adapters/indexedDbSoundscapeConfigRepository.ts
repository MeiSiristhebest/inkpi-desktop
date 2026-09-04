import { db } from "../db/indexedDB"
import type {
  SoundscapeConfigRecord,
  SoundscapeConfigRepository,
} from "../ports/soundscapeConfigRepository"

export const indexedDbSoundscapeConfigRepository: SoundscapeConfigRepository = {
  async get(projectId: string): Promise<SoundscapeConfigRecord | undefined> {
    return await db.get<SoundscapeConfigRecord>("soundscapeConfigs", projectId)
  },

  async save(record: SoundscapeConfigRecord): Promise<void> {
    await db.put("soundscapeConfigs", record)
  },
}
