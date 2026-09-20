import { useState, useEffect, useCallback } from 'react'
import type { TableRowRecord } from '../types'
import type { TableRecordRepository } from '../ports/tableRecordRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { indexedDbTableRecordRepository } from '../adapters/indexedDbTableRecordRepository'
import { legacyDomainApplicationService } from '../services/domainApplicationServices'
import { generateNextCodeByRule } from '../domain/rules/codeRule'

/** 台账视图模型实际写入所需的领域服务接口（结构子类型，便于 DI 与测试注入）。*/
export type TableDomainWriteService = Pick<
  typeof legacyDomainApplicationService,
  'saveTableRow' | 'deleteTableRow'
>
import { idGenerator } from '../adapters/idGenerator'
import { clock } from '../adapters/clock'

export interface UseTableViewModelOptions {
  projectId: string
  tabId: string
  codeRule?: string
  repository?: TableRecordRepository
  domainService?: TableDomainWriteService
  idGen?: IdGenerator
  clockPort?: Clock
}

export function useTableViewModel({
  projectId,
  tabId,
  codeRule,
  repository = indexedDbTableRecordRepository,
  domainService = legacyDomainApplicationService,
  idGen = idGenerator,
  clockPort = clock,
}: UseTableViewModelOptions) {
  const [rows, setRows] = useState<TableRowRecord[]>([])
  const [editingRow, setEditingRow] = useState<TableRowRecord | null>(null)
  const [isNewRow, setIsNewRow] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await repository.getRows(projectId, tabId)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [projectId, tabId, repository])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const createRow = useCallback(() => {
    const autoCode = generateNextCodeByRule(codeRule, rows)
    const initData: Record<string, unknown> = {}
    if (autoCode) initData['编号'] = autoCode

    const newRecord: TableRowRecord = {
      id: idGen.generate('row'),
      projectId,
      tabId,
      order: rows.length,
      data: initData,
      createdAt: clockPort.now(),
      updatedAt: clockPort.now(),
    }
    setIsNewRow(true)
    setEditingRow(newRecord)
    return newRecord
  }, [codeRule, rows, projectId, tabId, idGen, clockPort])

  const saveEditing = useCallback(async () => {
    if (!editingRow) return
    const record: TableRowRecord = {
      ...editingRow,
      updatedAt: clockPort.now(),
    }
    await domainService.saveTableRow(record)
    setEditingRow(null)
    setIsNewRow(false)
    await loadRows()
  }, [editingRow, domainService, loadRows, clockPort])

  const deleteRow = useCallback(
    async (id: string) => {
      await domainService.deleteTableRow(id, projectId)
      if (editingRow?.id === id) {
        setEditingRow(null)
        setIsNewRow(false)
      }
      await loadRows()
    },
    [editingRow, domainService, loadRows, projectId],
  )

  const cancelEditing = useCallback(() => {
    setEditingRow(null)
    setIsNewRow(false)
  }, [])

  return {
    rows,
    loading,
    editingRow,
    isNewRow,
    setEditingRow,
    createRow,
    saveEditing,
    deleteRow,
    cancelEditing,
    reload: loadRows,
  }
}
