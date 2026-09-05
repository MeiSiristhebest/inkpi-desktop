import { db } from "../db/indexedDB"
import type {
  MultiverseBranchRecord,
  MultiverseRepository,
} from "../ports/multiverseRepository"

export const indexedDbMultiverseRepository: MultiverseRepository = {
  async getAll(projectId: string): Promise<MultiverseBranchRecord[]> {
    return db.getByIndex<MultiverseBranchRecord>("multiverseBranches", 'projectId', projectId)
  },

  async get(id: string): Promise<MultiverseBranchRecord | undefined> {
    return await db.get<MultiverseBranchRecord>("multiverseBranches", id)
  },

  async save(record: MultiverseBranchRecord): Promise<void> {
    await db.put("multiverseBranches", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("multiverseBranches", id)
  },
}

