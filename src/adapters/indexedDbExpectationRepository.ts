import { db } from '../db/indexedDB'
import type {
  ExpectationContract,
  ExpectationRepository,
} from '../ports/expectationRepository'

export const indexedDbExpectationRepository: ExpectationRepository = {
  async getAll(projectId?: string): Promise<ExpectationContract[]> {
    if (projectId) {
      return db.getByIndex<ExpectationContract>('expectationContracts', 'projectId', projectId)
    }
    return db.getAll<ExpectationContract>('expectationContracts')
  },
  async save(contract: ExpectationContract): Promise<void> {
    await db.put('expectationContracts', contract)
  },
  async delete(id: string): Promise<void> {
    await db.delete('expectationContracts', id)
  },
}
