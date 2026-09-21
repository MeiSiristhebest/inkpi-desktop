import { db } from '../db/indexedDB'
import type { PowerTierSystem, PowerTierRepository } from '../ports/powerTierRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export const indexedDbPowerTierRepository: PowerTierRepository = {
  async get(projectId: string): Promise<PowerTierSystem | null> {
    const res = await db.get<PowerTierSystem>('powerTierSystems', projectId)
    return res || null
  },
  async save(system: PowerTierSystem): Promise<void> {
    const existing = await db.get<PowerTierSystem>('powerTierSystems', system.projectId)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'power-tier-system',
      aggregateId: system.projectId,
      workspaceId: system.projectId,
      store: 'powerTierSystems',
      record: system,
      existing,
    })
  },
  async delete(projectId: string): Promise<void> {
    const existing = await db.get<PowerTierSystem>('powerTierSystems', projectId)
    await appendAuthoritativePluginDelete({
      aggregateType: 'power-tier-system',
      aggregateId: projectId,
      workspaceId: projectId,
      store: 'powerTierSystems',
      existing,
    })
  },
}
