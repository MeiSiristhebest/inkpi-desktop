import { db } from '../db/indexedDB'
import type { TableRowRecord } from '../types'
import type { TableRecordRepository } from '../ports/tableRecordRepository'

export class IndexedDbTableRecordRepository implements TableRecordRepository {
  async getRows(projectId: string, tabId: string): Promise<TableRowRecord[]> {
    const all = await db.getAll<TableRowRecord>('tableRows')
    return all.filter((r) => r.projectId === projectId && r.tabId === tabId)
  }

  async saveRow(row: TableRowRecord): Promise<void> {
    await db.put('tableRows', row)
  }

  async deleteRow(id: string): Promise<void> {
    await db.delete('tableRows', id)
  }
}

export const indexedDbTableRecordRepository = new IndexedDbTableRecordRepository()
export const defaultTableRecordRepository = indexedDbTableRecordRepository
