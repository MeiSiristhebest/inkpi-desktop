import { db } from '../db/indexedDB'
import type { FormDataRecord } from '../types'
import type { FormDataRepository } from '../ports/formDataRepository'
import { appendAuthoritativePluginUpsert } from '../services/authoritativePluginWrite'

export class IndexedDbFormDataRepository implements FormDataRepository {
  async getFormData(projectId: string, tabId: string): Promise<Record<string, unknown>> {
    const fullKey = `${projectId}::${tabId}`
    const rec = await db.get<FormDataRecord>('formData', fullKey)
    return rec?.data || {}
  }

  async saveFormData(
    projectId: string,
    tabId: string,
    data: Record<string, unknown>,
    expectedCurrentData?: Record<string, unknown>,
  ): Promise<void> {
    const fullKey = `${projectId}::${tabId}`
    const existing = await db.get<FormDataRecord>('formData', fullKey)
    if (
      expectedCurrentData !== undefined &&
      !areValuesEqual(existing?.data ?? {}, expectedCurrentData)
    ) {
      throw new Error('Form data changed while preparing the update. Reload and try again.')
    }
    const record: FormDataRecord = { id: fullKey, projectId, tabId, data }
    await appendAuthoritativePluginUpsert({
      aggregateType: 'form',
      aggregateId: fullKey,
      workspaceId: projectId,
      store: 'formData',
      record,
      existing,
    })
  }
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime()
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areValuesEqual(value, right[index]))
    )
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }
  const entries = (value: Record<string, unknown>) =>
    Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  const leftEntries = entries(left as Record<string, unknown>)
  const rightEntries = entries(right as Record<string, unknown>)
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value], index) => {
      const rightEntry = rightEntries[index]
      return (
        rightEntry !== undefined && key === rightEntry[0] && areValuesEqual(value, rightEntry[1])
      )
    })
  )
}

export const indexedDbFormDataRepository = new IndexedDbFormDataRepository()
export const defaultFormDataRepository = indexedDbFormDataRepository
