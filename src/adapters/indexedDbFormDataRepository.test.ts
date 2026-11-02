import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import { IndexedDbFormDataRepository } from './indexedDbFormDataRepository'

const projectId = 'world-pack-form-cas-test'
const recordId = `${projectId}::worldbase`
const repository = new IndexedDbFormDataRepository()

afterEach(async () => {
  await db.delete('formData', recordId)
})

describe('IndexedDbFormDataRepository optimistic form-data writes', () => {
  it('refuses to overwrite data changed since an additive merge was prepared', async () => {
    const currentData = { tone: 'target value', nested: { era: 'current' } }
    await db.put('formData', {
      id: recordId,
      projectId,
      tabId: 'worldbase',
      data: currentData,
    })

    await expect(
      repository.saveFormData(
        projectId,
        'worldbase',
        { tone: 'stale value', nested: { era: 'current' }, added: 'pack value' },
        { tone: 'earlier value', nested: { era: 'current' } },
      ),
    ).rejects.toThrow('Form data changed while preparing the update.')
    expect(await db.get('formData', recordId)).toMatchObject({ data: currentData })
  })
})
