import { db } from '../db/indexedDB'
import type { FormDataRecord } from '../types'
import type { FormDataRepository } from '../ports/formDataRepository'

export class IndexedDbFormDataRepository implements FormDataRepository {
  async getFormData(projectId: string, tabId: string): Promise<Record<string, any>> {
    const fullKey = `${projectId}::${tabId}`
    const rec = await db.get<FormDataRecord>('formData', fullKey)
    return rec?.data || {}
  }

  async saveFormData(projectId: string, tabId: string, data: Record<string, any>): Promise<void> {
    const fullKey = `${projectId}::${tabId}`
    const record: FormDataRecord = { id: fullKey, projectId, tabId, data }
    await db.put('formData', record)
  }
}

export const indexedDbFormDataRepository = new IndexedDbFormDataRepository()
export const defaultFormDataRepository = indexedDbFormDataRepository
