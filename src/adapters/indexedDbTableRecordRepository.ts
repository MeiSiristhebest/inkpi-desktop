import { db } from '../db/indexedDB'
import type { TableRowRecord } from '../types'
import type { TableRecordRepository } from '../ports/tableRecordRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export class IndexedDbTableRecordRepository implements TableRecordRepository {
  async getRows(projectId: string, tabId: string): Promise<TableRowRecord[]> {
    const all = await db.getAll<TableRowRecord>('tableRows')
    return all.filter((r) => r.projectId === projectId && r.tabId === tabId)
  }

  async saveRow(row: TableRowRecord): Promise<void> {
    const existing = await db.get<TableRowRecord>('tableRows', row.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'table-row',
      aggregateId: row.id,
      workspaceId: row.projectId,
      store: 'tableRows',
      record: row,
      existing,
    })
  }

  async deleteRow(id: string): Promise<void> {
    const existing = await db.get<TableRowRecord>('tableRows', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'table-row',
      aggregateId: id,
      store: 'tableRows',
      existing,
    })
  }
}

export const indexedDbTableRecordRepository = new IndexedDbTableRecordRepository()
export const defaultTableRecordRepository = indexedDbTableRecordRepository
