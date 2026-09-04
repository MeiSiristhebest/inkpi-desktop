import { db } from '../db/indexedDB'
import type { CombatDuelRecord, CombatSandboxRepository } from '../ports/combatSandboxRepository'

export const indexedDbCombatSandboxRepository: CombatSandboxRepository = {
  async getAll(projectId: string): Promise<CombatDuelRecord[]> {
    const all = await db.getAll<CombatDuelRecord>('combatDuels')
    return all.filter((r) => r.projectId === projectId)
  },

  async get(id: string): Promise<CombatDuelRecord | undefined> {
    return await db.get<CombatDuelRecord>('combatDuels', id)
  },

  async save(record: CombatDuelRecord): Promise<void> {
    await db.put('combatDuels', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('combatDuels', id)
  },
}
