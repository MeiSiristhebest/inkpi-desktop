import { db } from '../db/indexedDB'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { PromiseLedgerRepository } from '../ports/promiseLedgerRepository'

/**
 * IndexedDB 伏笔债务账本仓储适配器：把端口方法映射到 inkpi-studio 的 promiseLedger 表。
 */
export const indexedDbPromiseLedgerRepository: PromiseLedgerRepository = {
  getAll: () => db.getAll<PromiseLedgerEntry>('promiseLedger'),
  save: (entry) => db.put('promiseLedger', entry),
  delete: (id) => db.delete('promiseLedger', id),
}
