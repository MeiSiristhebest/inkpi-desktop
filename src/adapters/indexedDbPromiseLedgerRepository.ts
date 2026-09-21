import { db } from '../db/indexedDB'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { PromiseLedgerRepository } from '../ports/promiseLedgerRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

/**
 * IndexedDB 伏笔债务账本仓储适配器：把端口方法映射到 inkpi-studio 的 promiseLedger 表。
 */
export const indexedDbPromiseLedgerRepository: PromiseLedgerRepository = {
  getAll: () => db.getAll<PromiseLedgerEntry>('promiseLedger'),
  save: async (entry) => {
    const existing = await db.get<PromiseLedgerEntry>('promiseLedger', entry.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'promise-ledger',
      aggregateId: entry.id,
      workspaceId: entry.projectId,
      store: 'promiseLedger',
      record: entry,
      existing,
    })
  },
  delete: async (id) => {
    const existing = await db.get<PromiseLedgerEntry>('promiseLedger', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'promise-ledger',
      aggregateId: id,
      store: 'promiseLedger',
      existing,
    })
  },
}
