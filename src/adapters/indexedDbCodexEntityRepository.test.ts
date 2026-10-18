import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/indexedDB'
import { indexedDbCodexEntityRepository } from './indexedDbCodexEntityRepository'

afterEach(() => vi.restoreAllMocks())

describe('indexedDbCodexEntityRepository', () => {
  it('loads codex entities through the project index', async () => {
    const entities = [{ id: 'entity-1', projectId: 'project-2' }]
    const getByIndex = vi.spyOn(db, 'getByIndex').mockResolvedValue(entities as never)

    await expect(indexedDbCodexEntityRepository.getByProject('project-2')).resolves.toBe(entities)

    expect(getByIndex).toHaveBeenCalledWith('codexEntities', 'projectId', 'project-2')
  })
})
