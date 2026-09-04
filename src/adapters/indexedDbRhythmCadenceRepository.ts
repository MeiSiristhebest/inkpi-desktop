import { db } from '../db/indexedDB'
import type {
  RhythmCadenceRecord,
  RhythmCadenceRepository,
} from '../ports/rhythmCadenceRepository'

export const indexedDbRhythmCadenceRepository: RhythmCadenceRepository = {
  async get(projectId: string): Promise<RhythmCadenceRecord | undefined> {
    return await db.get<RhythmCadenceRecord>('rhythmCadences', projectId)
  },

  async save(record: RhythmCadenceRecord): Promise<void> {
    await db.put('rhythmCadences', record)
  },
}
