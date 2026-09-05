import { db } from '../db/indexedDB'
import type {
  PaywallAuditRecord,
  PaywallAuditRepository,
} from '../ports/paywallAuditRepository'

export const indexedDbPaywallAuditRepository: PaywallAuditRepository = {
  async getAll(projectId: string): Promise<PaywallAuditRecord[]> {
    return db.getByIndex<PaywallAuditRecord>('paywallAudits', 'projectId', projectId)
  },

  async getByChapterId(chapterId: string): Promise<PaywallAuditRecord | undefined> {
    const all = await db.getAll<PaywallAuditRecord>('paywallAudits')
    return all.find((r) => r.chapterId === chapterId)
  },

  async save(record: PaywallAuditRecord): Promise<void> {
    await db.put('paywallAudits', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('paywallAudits', id)
  },
}
