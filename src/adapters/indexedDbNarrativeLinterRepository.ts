import { db } from "../db/indexedDB"
import type {
  LinterProjectConfigRecord,
  NarrativeLinterRepository,
} from "../ports/narrativeLinterRepository"

export const indexedDbNarrativeLinterRepository: NarrativeLinterRepository = {
  async getConfig(projectId: string): Promise<LinterProjectConfigRecord | undefined> {
    return await db.get<LinterProjectConfigRecord>("linterRulesConfigs", projectId)
  },

  async saveConfig(record: LinterProjectConfigRecord): Promise<void> {
    await db.put("linterRulesConfigs", record)
  },
}
