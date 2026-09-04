import type { TableRowRecord } from '../types'

/**
 * 设定台账仓储端口 (DIP)
 */
export interface TableRecordRepository {
  getRows(projectId: string, tabId: string): Promise<TableRowRecord[]>
  saveRow(row: TableRowRecord): Promise<void>
  deleteRow(id: string): Promise<void>
}
