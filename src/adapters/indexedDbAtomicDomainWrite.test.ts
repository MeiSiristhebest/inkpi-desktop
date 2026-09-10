import { describe, expect, it } from 'vitest'
import type { ChapterRecord } from '../types'
import { db } from '../db/indexedDB'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { IndexedDbDomainChangeStore } from './indexedDbDomainChangeStore'
import { indexedDbProjectRepository } from './indexedDbProjectRepository'

describe('atomic IndexedDB domain writes', () => {
  it('commits a chapter and its DomainChangeSet in one transaction', async () => {
    const workspaceId = 'atomic-domain-write-workspace'
    const chapterId = 'atomic-domain-write-chapter'
    await db.delete('chapters', chapterId)
    for (const changeSet of await new IndexedDbDomainChangeStore().list(workspaceId)) {
      await db.delete('domainChangeSets', changeSet.id)
    }

    const chapter: ChapterRecord = {
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'volume-1',
      title: '原子写入',
      content: '正文',
      order: 0,
      wordCount: 2,
      createdAt: 1,
      updatedAt: 1,
    }
    await indexedDbProjectRepository.saveChapter(chapter)

    expect(await db.get('chapters', chapterId)).toEqual(chapter)
    expect(await new IndexedDbDomainChangeStore().latestRevision(workspaceId)).toBe(1)
  })

  it('rejects a stale concurrent aggregate writer without appending a second change', async () => {
    const workspaceId = 'atomic-domain-concurrency-workspace'
    const chapterId = 'atomic-domain-concurrency-chapter'
    await db.delete('chapters', chapterId)
    for (const changeSet of await new IndexedDbDomainChangeStore().list(workspaceId)) {
      await db.delete('domainChangeSets', changeSet.id)
    }

    const first: ChapterRecord = {
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'volume-1',
      title: '第一写入',
      content: '甲',
      order: 0,
      wordCount: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    const second = { ...first, title: '第二写入', content: '乙', updatedAt: 2 }
    const results = await Promise.allSettled([
      indexedDbProjectRepository.saveChapter(first),
      indexedDbProjectRepository.saveChapter(second),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await new IndexedDbDomainChangeStore().latestRevision(workspaceId)).toBe(1)
    expect(await db.get<ChapterRecord>('chapters', chapterId)).toEqual(first)
  })

  it('rolls back the domain append when the aggregate cannot be cloned', async () => {
    const workspaceId = 'atomic-domain-rollback-workspace'
    const store = new IndexedDbDomainChangeStore()
    const changeSet = createDomainChangeSet({
      id: 'atomic-domain-rollback-change',
      workspaceId,
      sourceDeviceId: 'desktop-test',
      baseRevision: 0,
      changes: [
        {
          id: 'atomic-domain-rollback-change-entry',
          aggregateType: 'chapter',
          aggregateId: 'atomic-domain-rollback-chapter',
          operation: 'upsert',
          revision: 0,
          payload: { title: '回滚' },
          occurredAt: 1,
        },
      ],
      createdAt: 1,
    })

    await expect(
      store.appendWithAggregate(changeSet, {
        store: 'chapters',
        key: 'atomic-domain-rollback-chapter',
        operation: 'upsert',
        value: { id: 'atomic-domain-rollback-chapter', invalid: () => undefined },
        expected: undefined,
      }),
    ).rejects.toThrow()
    expect(await store.latestRevision(workspaceId)).toBe(0)
    expect(await db.get('chapters', 'atomic-domain-rollback-chapter')).toBeUndefined()
  })
})
