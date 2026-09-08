import { describe, expect, it } from 'vitest'
import type { DomainChange } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { IndexedDbDomainChangeStore } from '../../adapters/indexedDbDomainChangeStore'
import { createDomainChangeSet } from './domainChangeSet'

const change: DomainChange = {
  id: 'change-1',
  aggregateType: 'document',
  aggregateId: 'chapter-1',
  operation: 'upsert',
  revision: 1,
  payload: { title: '第一章' },
  occurredAt: 1,
}

describe('authoritative IndexedDB domain change log', () => {
  it('appends ordered change sets and rejects stale writers', async () => {
    const store = new IndexedDbDomainChangeStore()
    const workspaceId = 'sync-workspace'
    for (const record of await db.getAll<{ id: string }>('domainChangeSets')) {
      await db.delete('domainChangeSets', record.id)
    }

    await store.append(
      createDomainChangeSet({
        id: 'set-1',
        workspaceId,
        sourceDeviceId: 'desktop-a',
        baseRevision: 0,
        changes: [change],
        createdAt: 1,
      }),
    )
    expect(await store.latestRevision(workspaceId)).toBe(1)
    expect((await store.list(workspaceId))[0].changes[0].aggregateId).toBe('chapter-1')
    await expect(
      store.append(
        createDomainChangeSet({
          id: 'set-stale',
          workspaceId,
          sourceDeviceId: 'desktop-a',
          baseRevision: 0,
          changes: [change],
          createdAt: 2,
        }),
      ),
    ).rejects.toThrow(/revision conflict/i)
  })

  it('rejects corrupted records and restores a validated snapshot', async () => {
    const store = new IndexedDbDomainChangeStore()
    const workspaceId = 'sync-recovery-workspace'
    for (const record of await db.getAll<{ id: string; workspaceId?: string }>('domainChangeSets')) {
      if (record.workspaceId === workspaceId) await db.delete('domainChangeSets', record.id)
    }
    const first = createDomainChangeSet({
      id: 'recovery-set-1',
      workspaceId,
      sourceDeviceId: 'desktop-a',
      baseRevision: 0,
      changes: [change],
      createdAt: 3,
    })
    await store.append(first)
    const snapshot = await store.createSnapshot(workspaceId)
    await db.put('domainChangeSets', { ...first, checksum: 'corrupt' })
    await expect(store.list(workspaceId)).rejects.toThrow(/checksum/i)
    await store.restoreSnapshot(snapshot)
    expect(await store.latestRevision(workspaceId)).toBe(1)

    await expect(
      store.restoreSnapshot({
        ...snapshot,
        revision: 2,
      }),
    ).rejects.toThrow(/cursor|contiguous/i)
  })
})
