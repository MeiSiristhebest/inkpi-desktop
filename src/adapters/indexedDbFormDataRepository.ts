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
  ): Promise<void> {
    const fullKey = `${projectId}::${tabId}`
    const record: FormDataRecord = { id: fullKey, projectId, tabId, data }
    const existing = await db.get<FormDataRecord>('formData', fullKey)
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

export const indexedDbFormDataRepository = new IndexedDbFormDataRepository()
export const defaultFormDataRepository = indexedDbFormDataRepository
