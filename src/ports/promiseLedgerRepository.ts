import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'

/**
 * 伏笔债务账本仓储端口（抽象）。
 */
export interface PromiseLedgerRepository {
  getAll(): Promise<PromiseLedgerEntry[]>
  save(entry: PromiseLedgerEntry): Promise<void>
  delete(id: string): Promise<void>
}
