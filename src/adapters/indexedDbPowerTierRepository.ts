import { db } from '../db/indexedDB'
import type {
  PowerTierSystem,
  PowerTierRepository,
} from '../ports/powerTierRepository'

export const indexedDbPowerTierRepository: PowerTierRepository = {
  async get(projectId: string): Promise<PowerTierSystem | null> {
    const res = await db.get<PowerTierSystem>('powerTierSystems', projectId)
    return res || null
  },
  async save(system: PowerTierSystem): Promise<void> {
    await db.put('powerTierSystems', system)
  },
  async delete(projectId: string): Promise<void> {
    await db.delete('powerTierSystems', projectId)
  },
}
