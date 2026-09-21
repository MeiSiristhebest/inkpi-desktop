import { db } from '../db/indexedDB'
import type { ExpectationContract, ExpectationRepository } from '../ports/expectationRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export const indexedDbExpectationRepository: ExpectationRepository = {
  async getAll(projectId?: string): Promise<ExpectationContract[]> {
    if (projectId) {
      return db.getByIndex<ExpectationContract>('expectationContracts', 'projectId', projectId)
    }
    return db.getAll<ExpectationContract>('expectationContracts')
  },
  async save(contract: ExpectationContract): Promise<void> {
    const existing = await db.get<ExpectationContract>('expectationContracts', contract.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'expectation-contract',
      aggregateId: contract.id,
      workspaceId: contract.projectId,
      store: 'expectationContracts',
      record: contract,
      existing,
    })
  },
  async delete(id: string): Promise<void> {
    const existing = await db.get<ExpectationContract>('expectationContracts', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'expectation-contract',
      aggregateId: id,
      store: 'expectationContracts',
      existing,
    })
  },
}
