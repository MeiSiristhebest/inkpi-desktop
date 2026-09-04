import { db } from '../db/indexedDB'
import type {
  PressExportConfigRecord,
  PressConfigRepository,
} from '../ports/pressConfigRepository'

export const indexedDbPressConfigRepository: PressConfigRepository = {
  async get(projectId: string): Promise<PressExportConfigRecord | undefined> {
    return await db.get<PressExportConfigRecord>('pressExportConfigs', projectId)
  },

  async save(record: PressExportConfigRecord): Promise<void> {
    await db.put('pressExportConfigs', record)
  },
}
