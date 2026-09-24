import { describe, expect, it } from 'vitest'
import type { ChapterRecord, VolumeRecord } from '../types'
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

  it('does not mutate daily writing statistics when persisting a chapter directly', async () => {
    const workspaceId = 'atomic-domain-no-stats-workspace'
    const chapterId = 'atomic-domain-no-stats-chapter'
    const statsKey = `${workspaceId}::2026-01-01`
    await db.delete('chapters', chapterId)
    await db.delete('dailyStats', statsKey)
    for (const changeSet of await new IndexedDbDomainChangeStore().list(workspaceId)) {
      await db.delete('domainChangeSets', changeSet.id)
    }

    await indexedDbProjectRepository.saveChapter({
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'volume-1',
      title: '导入或系统写入',
      content: '正文',
      order: 0,
      wordCount: 2,
      createdAt: 1,
      updatedAt: 1,
    })

    expect(await db.get('dailyStats', statsKey)).toBeUndefined()
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

  it('treats identical concurrent seed writes as an idempotent success', async () => {
    const workspaceId = 'atomic-domain-idempotent-race-workspace'
    const chapterId = 'atomic-domain-idempotent-race-chapter'
    await db.delete('chapters', chapterId)
    const store = new IndexedDbDomainChangeStore()
    for (const changeSet of await store.list(workspaceId)) {
      await db.delete('domainChangeSets', changeSet.id)
    }

    const chapter: ChapterRecord = {
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'volume-1',
      title: '并发种子',
      content: '同一份初始内容',
      order: 0,
      wordCount: 6,
      createdAt: 1,
      updatedAt: 1,
    }
    const results = await Promise.allSettled([
      indexedDbProjectRepository.saveChapter(chapter),
      indexedDbProjectRepository.saveChapter(chapter),
    ])

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)
    expect(await db.get('chapters', chapterId)).toEqual(chapter)
    expect(await store.latestRevision(workspaceId)).toBe(1)
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

  it('does not reapply an already committed aggregate on duplicate replay', async () => {
    const workspaceId = 'atomic-domain-idempotence-workspace'
    const chapterId = 'atomic-domain-idempotence-chapter'
    const changeSet = createDomainChangeSet({
      id: 'atomic-domain-idempotence-change',
      workspaceId,
      sourceDeviceId: 'desktop-test',
      baseRevision: 0,
      changes: [
        {
          id: 'atomic-domain-idempotence-entry',
          aggregateType: 'chapter',
          aggregateId: chapterId,
          operation: 'upsert',
          revision: 0,
          payload: { title: '第一次写入' },
          occurredAt: 1,
        },
      ],
      createdAt: 1,
    })
    const store = new IndexedDbDomainChangeStore()
    await db.delete('chapters', chapterId)
    for (const existing of await store.list(workspaceId)) {
      await db.delete('domainChangeSets', existing.id)
    }

    const first = { id: chapterId, title: '第一次写入' }
    await store.appendWithAggregate(changeSet, {
      store: 'chapters',
      key: chapterId,
      operation: 'upsert',
      value: first,
      expected: undefined,
    })

    await store.appendWithAggregate(changeSet, {
      store: 'chapters',
      key: chapterId,
      operation: 'upsert',
      value: { id: chapterId, title: '重复回放不应覆盖' },
      expected: first,
    })

    expect(await db.get('chapters', chapterId)).toEqual(first)
    expect(await store.latestRevision(workspaceId)).toBe(1)
  })

  it('cascades a volume delete onto the fallback volume without touching a neighbour', async () => {
    const workspaceId = 'atomic-domain-cascade-workspace'
    const neighbourId = 'atomic-domain-cascade-neighbour'
    const volumeId = 'atomic-domain-cascade-volume'
    const fallbackVolumeId = 'atomic-domain-cascade-fallback'
    const journal = new IndexedDbDomainChangeStore()

    const chapter = (projectId: string, id: string, ownedVolume: string): ChapterRecord => ({
      id,
      projectId,
      volumeId: ownedVolume,
      title: '章节',
      content: '正文',
      order: 0,
      wordCount: 2,
      createdAt: 1,
      updatedAt: 1,
    })
    const volume = (projectId: string, id: string): VolumeRecord => ({
      id,
      projectId,
      title: '第一卷',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    })

    await db.put('chapters', chapter(workspaceId, 'cascade-c-1', volumeId))
    await db.put('chapters', chapter(workspaceId, 'cascade-c-2', volumeId))
    await db.put('chapters', chapter(workspaceId, 'cascade-c-3', fallbackVolumeId))
    await db.put('chapters', chapter(neighbourId, 'cascade-neighbour-1', volumeId))
    await db.put('volumes', volume(workspaceId, volumeId))
    for (const scoped of [workspaceId, neighbourId]) {
      await db.put(
        'domainChangeSets',
        createDomainChangeSet({
          id: `cascade-seed-${scoped}`,
          workspaceId: scoped,
          sourceDeviceId: 'desktop-test',
          baseRevision: 0,
          changes: [
            {
              id: `cascade-seed-change-${scoped}`,
              aggregateType: 'chapter',
              aggregateId: `${scoped}-chapter`,
              operation: 'upsert',
              revision: 1,
              occurredAt: 1,
            },
          ],
          createdAt: 1,
        }),
      )
    }

    const result = await indexedDbProjectRepository.deleteVolumeCascade(
      workspaceId,
      volumeId,
      fallbackVolumeId,
    )

    expect(result.migratedChapters.map((record) => record.id).sort()).toEqual([
      'cascade-c-1',
      'cascade-c-2',
    ])
    expect(result.deletedChapterIds).toEqual([])
    expect((await db.get<ChapterRecord>('chapters', 'cascade-c-1'))?.volumeId).toBe(
      fallbackVolumeId,
    )
    expect(await db.get('volumes', volumeId)).toBeUndefined()

    // The journal head is read through the workspaceId index, so the appended change continues
    // this workspace's own history rather than starting over at revision 1.
    expect(result.finalWorkspaceRevision).toBe(2)
    expect(await journal.latestRevision(workspaceId)).toBe(2)

    // The neighbour happens to use the same volumeId: a whole-store scan filtered only on
    // volumeId would have migrated its chapter and written into its journal (INV-03).
    expect((await db.get<ChapterRecord>('chapters', 'cascade-neighbour-1'))?.volumeId).toBe(
      volumeId,
    )
    expect(await journal.list(neighbourId)).toHaveLength(1)
    expect((await journal.list(workspaceId)).at(-1)?.changes).toHaveLength(3)
  })

  it('deletes the child chapters when no fallback volume is given', async () => {
    const workspaceId = 'atomic-domain-cascade-hard-workspace'
    const volumeId = 'atomic-domain-cascade-hard-volume'
    const journal = new IndexedDbDomainChangeStore()

    await db.put('chapters', {
      id: 'cascade-hard-c-1',
      projectId: workspaceId,
      volumeId,
      title: '章节',
      content: '正文',
      order: 0,
      wordCount: 2,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('volumes', {
      id: volumeId,
      projectId: workspaceId,
      title: '第一卷',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await indexedDbProjectRepository.deleteVolumeCascade(workspaceId, volumeId)

    expect(result.deletedChapterIds).toEqual(['cascade-hard-c-1'])
    expect(result.migratedChapters).toEqual([])
    expect(await db.get('chapters', 'cascade-hard-c-1')).toBeUndefined()
    expect(await db.get('volumes', volumeId)).toBeUndefined()
    expect(result.finalWorkspaceRevision).toBe(1)
    expect(await journal.latestRevision(workspaceId)).toBe(1)
  })
})
