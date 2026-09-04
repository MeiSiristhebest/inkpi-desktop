import { db } from "../db/indexedDB"
import type {
  AuthorOpsProfileRecord,
  AuthorOpsRepository,
} from "../ports/authorOpsRepository"

export const indexedDbAuthorOpsRepository: AuthorOpsRepository = {
  async get(projectId: string): Promise<AuthorOpsProfileRecord | undefined> {
    return await db.get<AuthorOpsProfileRecord>("authorOpsProfiles", projectId)
  },

  async save(record: AuthorOpsProfileRecord): Promise<void> {
    await db.put("authorOpsProfiles", record)
  },
}
