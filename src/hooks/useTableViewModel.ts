import { useState, useEffect, useCallback } from 'react'
import type { TableRowRecord } from '../types'
import type { TableRecordRepository } from '../ports/tableRecordRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { indexedDbTableRecordRepository } from '../adapters/indexedDbTableRecordRepository'
import { generateNextCodeByRule } from '../domain/rules/codeRule'
import { idGenerator } from '../adapters/idGenerator'
import { clock } from '../adapters/clock'

export interface UseTableViewModelOptions {
  projectId: string
  tabId: string
  codeRule?: string
  repository?: TableRecordRepository
  idGen?: IdGenerator
  clockPort?: Clock
}

export function useTableViewModel({
  projectId,
  tabId,
  codeRule,
  repository = indexedDbTableRecordRepository,
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
    await repository.saveRow(record)
    setEditingRow(null)
    setIsNewRow(false)
    await loadRows()
  }, [editingRow, repository, loadRows, clockPort])

  const deleteRow = useCallback(
    async (id: string) => {
      await repository.deleteRow(id)
      if (editingRow?.id === id) {
        setEditingRow(null)
        setIsNewRow(false)
      }
      await loadRows()
    },
    [editingRow, repository, loadRows],
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
