import { db } from "../db/indexedDB"
import type {
  ScrapbookFragmentRecord,
  ScrapbookRepository,
} from "../ports/scrapbookRepository"

export const indexedDbScrapbookRepository: ScrapbookRepository = {
  async getAll(projectId: string): Promise<ScrapbookFragmentRecord[]> {
    const all = await db.getAll<ScrapbookFragmentRecord>("scrapbookFragments")
    return all.filter((r) => r.projectId === projectId)
  },

  async get(id: string): Promise<ScrapbookFragmentRecord | undefined> {
    return await db.get<ScrapbookFragmentRecord>("scrapbookFragments", id)
  },

  async save(record: ScrapbookFragmentRecord): Promise<void> {
    await db.put("scrapbookFragments", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("scrapbookFragments", id)
  },
}
