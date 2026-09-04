import { db } from "../db/indexedDB"
import type {
  IronChamberRecord,
  IronChamberRepository,
} from "../ports/ironChamberRepository"

export const indexedDbIronChamberRepository: IronChamberRepository = {
  async getAll(projectId: string): Promise<IronChamberRecord[]> {
    const all = await db.getAll<IronChamberRecord>("ironChamberRecords")
    return all.filter((r) => r.projectId === projectId)
  },

  async getActive(projectId: string): Promise<IronChamberRecord | undefined> {
    const all = await db.getAll<IronChamberRecord>("ironChamberRecords")
    return all.find((r) => r.projectId === projectId && r.status === "locked")
  },

  async get(id: string): Promise<IronChamberRecord | undefined> {
    return await db.get<IronChamberRecord>("ironChamberRecords", id)
  },

  async save(record: IronChamberRecord): Promise<void> {
    await db.put("ironChamberRecords", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("ironChamberRecords", id)
  },
}
