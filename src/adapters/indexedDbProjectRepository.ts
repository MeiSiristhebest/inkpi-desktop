<<<<<<< ours
import { db } from '../db/indexedDB'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import { indexedDbDailyStatsRepository } from './indexedDbDailyStatsRepository'
import {
  IndexedDbDomainChangeStore,
  type IndexedDbAggregateWrite,
} from './indexedDbDomainChangeStore'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import type { DeleteVolumeCascadeResult } from '../ports/projectCommand'

const domainChangeStore = new IndexedDbDomainChangeStore()
// DomainChangeSet revisions are allocated by reading the current workspace
// revision. Serialize that read-and-append pair so Promise.all callers cannot
// all observe the same base revision.
let domainAppendQueue: Promise<void> = Promise.resolve()
const sourceDeviceId =
  typeof localStorage === 'undefined'
    ? 'desktop'
    : localStorage.getItem('inkpi-device-id') ||
      (() => {
        const id = `desktop-${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem('inkpi-device-id', id)
        return id
      })()

/**
 * IndexedDB 项目仓储适配器：把端口方法映射到 inkpi-studio 数据库的具体 CRUD。
 * 这是唯一直接接触 IndexedDB 实现细节的地方；业务层不会直接 import db。
 */
export const indexedDbProjectRepository: ProjectRepository = {
  getAllProjects: () => db.getAll<ProjectRecord>('projects'),
  getProject: (id) => db.get<ProjectRecord>('projects', id),
  saveProject: async (project) => {
    const existing = await db.get<ProjectRecord>('projects', project.id).catch(() => undefined)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(project)) {
      await appendDomainChange(
        'project',
        project.id,
        project.id,
        'upsert',
        project,
        project.updatedAt,
        0,
        {
          store: 'projects',
          key: project.id,
          operation: 'upsert',
          value: project,
          expected: existing,
        },
      )
    }
  },
  deleteProject: async (id) => {
    const existing = await db.get<ProjectRecord>('projects', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange('project', id, id, 'delete', undefined, Date.now(), 0, {
        store: 'projects',
        key: id,
        operation: 'delete',
        expected: existing,
      })
    }
  },

  getAllVolumes: () => db.getAll<VolumeRecord>('volumes'),
  getVolumesByProject: (projectId) =>
    db.getAll<VolumeRecord>('volumes').then((vs) => vs.filter((v) => v.projectId === projectId)),
  saveVolume: async (volume) => {
    const existing = await db.get<VolumeRecord>('volumes', volume.id).catch(() => undefined)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(volume)) {
      await appendDomainChange(
        'volume',
        volume.id,
        volume.projectId,
        'upsert',
        volume,
        volume.updatedAt,
        0,
        {
          store: 'volumes',
          key: volume.id,
          operation: 'upsert',
          value: volume,
          expected: existing,
        },
      )
    }
  },
  deleteVolume: async (id) => {
    const existing = await db.get<VolumeRecord>('volumes', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange(
        'volume',
        id,
        existing.projectId,
        'delete',
        undefined,
        Date.now(),
        0,
        { store: 'volumes', key: id, operation: 'delete', expected: existing },
      )
    }
  },
  deleteVolumeCascade: async (
    workspaceId: string,
    volumeId: string,
    fallbackVolumeId?: string,
  ): Promise<DeleteVolumeCascadeResult> => {
    const result: DeleteVolumeCascadeResult = {
      finalWorkspaceRevision: 0,
      migratedChapters: [],
      deletedChapterIds: [],
    }

    await db.runTransaction(['volumes', 'chapters', 'domainChangeSets'], (transaction, fail) => {
      const volumeStore = transaction.objectStore('volumes')
      const chapterStore = transaction.objectStore('chapters')
      const domainStore = transaction.objectStore('domainChangeSets')

      const volumeReq = volumeStore.get(volumeId)
      const chaptersReq = chapterStore.getAll()
      const domainReq = domainStore.getAll()

      let volumeLoaded = false
      let chaptersLoaded = false
      let domainLoaded = false

      let volumeRecord: VolumeRecord | undefined
      let allChapters: ChapterRecord[] | undefined
      let allDomainChanges: any[] | undefined

      const checkReady = () => {
        if (!volumeLoaded || !chaptersLoaded || !domainLoaded) return
        try {
          if (!volumeRecord) {
            // Volume already deleted or doesn't exist
            return
          }

          const now = Date.now()
          const changes: any[] = []
          const relatedChapters = (allChapters || []).filter(
            (ch) => ch.projectId === workspaceId && ch.volumeId === volumeId,
          )

          if (fallbackVolumeId) {
            // Migrate all child chapters to fallback volume
            for (const ch of relatedChapters) {
              const updated: ChapterRecord = {
                ...ch,
                volumeId: fallbackVolumeId,
                updatedAt: now,
              }
              chapterStore.put(updated)
              result.migratedChapters.push(updated)
              changes.push({
                id: `chapter-change-${ch.id}-${ch.revision ?? 0}-${now}`,
                aggregateType: 'chapter',
                aggregateId: ch.id,
                operation: 'upsert',
                revision: ch.revision ?? 0,
                payload: updated,
                occurredAt: now,
              })
            }
          } else {
            // Delete all child chapters
            for (const ch of relatedChapters) {
              chapterStore.delete(ch.id)
              result.deletedChapterIds.push(ch.id)
              changes.push({
                id: `chapter-change-${ch.id}-${ch.revision ?? 0}-${now}`,
                aggregateType: 'chapter',
                aggregateId: ch.id,
                operation: 'delete',
                revision: ch.revision ?? 0,
                occurredAt: now,
              })
            }
          }

          // Delete the volume itself
          volumeStore.delete(volumeId)
          changes.push({
            id: `volume-change-${volumeId}-0-${now}`,
            aggregateType: 'volume',
            aggregateId: volumeId,
            operation: 'delete',
            revision: 0,
            occurredAt: now,
          })

          // Append DomainChangeSet atomically
          const workspaceChanges = (allDomainChanges || [])
            .filter((record: any) => record.workspaceId === workspaceId)
            .sort((a: any, b: any) => a.revision - b.revision)
          const baseRevision = workspaceChanges.at(-1)?.revision ?? 0
          result.finalWorkspaceRevision = baseRevision + 1

          const changeSet = createDomainChangeSet({
            id: `delete-volume-${volumeId}-${now}`,
            workspaceId,
            sourceDeviceId,
            baseRevision,
            changes,
            createdAt: now,
          })

          domainStore.put(changeSet)
        } catch (err) {
          fail(err)
        }
      }

      volumeReq.onsuccess = () => {
        volumeRecord = volumeReq.result
        volumeLoaded = true
        checkReady()
      }
      volumeReq.onerror = () => fail(volumeReq.error)

      chaptersReq.onsuccess = () => {
        allChapters = chaptersReq.result
        chaptersLoaded = true
        checkReady()
      }
      chaptersReq.onerror = () => fail(chaptersReq.error)

      domainReq.onsuccess = () => {
        allDomainChanges = domainReq.result
        domainLoaded = true
        checkReady()
      }
      domainReq.onerror = () => fail(domainReq.error)
    })

    domainChangeEvents.publish(workspaceId, result.finalWorkspaceRevision)
    return result
  },

  getAllChapters: () => db.getAll<ChapterRecord>('chapters'),
  getChaptersByProject: (projectId) =>
    db.getAll<ChapterRecord>('chapters').then((cs) => cs.filter((c) => c.projectId === projectId)),
  saveChapter: async (chapter) => {
    let existing: ChapterRecord | undefined
    if (typeof db.get === 'function') {
      existing = await db.get<ChapterRecord>('chapters', chapter.id).catch(() => undefined)
    }
    if (!existing || JSON.stringify(existing) !== JSON.stringify(chapter)) {
      await appendDomainChange(
        'chapter',
        chapter.id,
        chapter.projectId,
        'upsert',
        chapter,
        chapter.updatedAt,
        chapter.revision ?? 0,
        {
          store: 'chapters',
          key: chapter.id,
          operation: 'upsert',
          value: chapter,
          expected: existing,
        },
      )
    }
    if (existing && existing.wordCount !== chapter.wordCount) {
      const delta = chapter.wordCount - existing.wordCount
      await indexedDbDailyStatsRepository.recordDailyWords(chapter.projectId, delta).catch(() => {})
    } else if (!existing && chapter.wordCount > 0) {
      await indexedDbDailyStatsRepository
        .recordDailyWords(chapter.projectId, chapter.wordCount)
        .catch(() => {})
    }
  },

  saveChapterCAS: async ({ chapter, expectedRevision }) => {
    let current: ChapterRecord | undefined
    if (typeof db.get === 'function') {
      current = await db.get<ChapterRecord>('chapters', chapter.id).catch(() => undefined)
    }

    const currentRev = current?.revision ?? 1
    if (current && currentRev !== expectedRevision) {
      return {
        success: false,
        conflict: true,
        currentRevision: currentRev,
        error: `CAS Conflict: Expected revision ${expectedRevision}, but current database revision is ${currentRev}`,
      }
    }

    await appendDomainChange(
      'chapter',
      chapter.id,
      chapter.projectId,
      'upsert',
      chapter,
      chapter.updatedAt,
      chapter.revision ?? 0,
      {
        store: 'chapters',
        key: chapter.id,
        operation: 'upsert',
        value: chapter,
        expected: current,
      },
    )

    return {
      success: true,
      conflict: false,
      currentRevision: chapter.revision,
    }
  },
  deleteChapter: async (id) => {
    const existing = await db.get<ChapterRecord>('chapters', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange(
        'chapter',
        id,
        existing.projectId,
        'delete',
        undefined,
        Date.now(),
        existing.revision ?? 0,
        { store: 'chapters', key: id, operation: 'delete', expected: existing },
      )
    }
  },
}

async function appendDomainChange(
  aggregateType: string,
  aggregateId: string,
  workspaceId: string,
  operation: 'upsert' | 'delete',
  payload: unknown,
  occurredAt: number,
  aggregateRevision = 0,
  aggregate?: IndexedDbAggregateWrite,
): Promise<void> {
  const operationPromise = domainAppendQueue.then(async () => {
    const baseRevision = await domainChangeStore.latestRevision(workspaceId)
    const changeId = `${aggregateType}-change-${aggregateId}-${aggregateRevision}-${occurredAt}`
    const changeSet = createDomainChangeSet({
      id: `${aggregateType}-${aggregateId}-${aggregateRevision}-${occurredAt}`,
      workspaceId,
      sourceDeviceId,
      baseRevision,
      changes: [
        {
          id: changeId,
          aggregateType,
          aggregateId,
          operation,
          revision: aggregateRevision,
          payload,
          occurredAt,
        },
      ],
      createdAt: occurredAt,
    })
    if (aggregate) await domainChangeStore.appendWithAggregate(changeSet, aggregate)
    else await domainChangeStore.append(changeSet)
    domainChangeEvents.publish(workspaceId, changeSet.baseRevision + 1)
  })
  domainAppendQueue = operationPromise.catch(() => undefined)
  await operationPromise
}
=======
import { db } from '../db/indexedDB'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import { indexedDbDailyStatsRepository } from './indexedDbDailyStatsRepository'
import {
  IndexedDbDomainChangeStore,
  type IndexedDbAggregateWrite,
} from './indexedDbDomainChangeStore'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import type { DeleteVolumeCascadeResult } from '../ports/projectCommand'

const domainChangeStore = new IndexedDbDomainChangeStore()
// DomainChangeSet revisions are allocated by reading the current workspace
// revision. Serialize that read-and-append pair so Promise.all callers cannot
// all observe the same base revision.
let domainAppendQueue: Promise<void> = Promise.resolve()
const sourceDeviceId =
  typeof localStorage === 'undefined'
    ? 'desktop'
    : localStorage.getItem('inkpi-device-id') ||
      (() => {
        const id = `desktop-${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem('inkpi-device-id', id)
        return id
      })()

/**
 * IndexedDB 项目仓储适配器：把端口方法映射到 inkpi-studio 数据库的具体 CRUD。
 * 这是唯一直接接触 IndexedDB 实现细节的地方；业务层不会直接 import db。
 */
export const indexedDbProjectRepository: ProjectRepository = {
  getAllProjects: () => db.getAll<ProjectRecord>('projects'),
  getProject: (id) => db.get<ProjectRecord>('projects', id),
  saveProject: async (project) => {
    const existing = await db.get<ProjectRecord>('projects', project.id).catch(() => undefined)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(project)) {
      await appendDomainChange(
        'project',
        project.id,
        project.id,
        'upsert',
        project,
        project.updatedAt,
        0,
        {
          store: 'projects',
          key: project.id,
          operation: 'upsert',
          value: project,
          expected: existing,
        },
      )
    }
  },
  deleteProject: async (id) => {
    const existing = await db.get<ProjectRecord>('projects', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange('project', id, id, 'delete', undefined, Date.now(), 0, {
        store: 'projects',
        key: id,
        operation: 'delete',
        expected: existing,
      })
    }
  },

  getAllVolumes: () => db.getAll<VolumeRecord>('volumes'),
  getVolumesByProject: (projectId) =>
    db.getAll<VolumeRecord>('volumes').then((vs) => vs.filter((v) => v.projectId === projectId)),
  saveVolume: async (volume) => {
    const existing = await db.get<VolumeRecord>('volumes', volume.id).catch(() => undefined)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(volume)) {
      await appendDomainChange(
        'volume',
        volume.id,
        volume.projectId,
        'upsert',
        volume,
        volume.updatedAt,
        0,
        {
          store: 'volumes',
          key: volume.id,
          operation: 'upsert',
          value: volume,
          expected: existing,
        },
      )
    }
  },
  deleteVolume: async (id) => {
    const existing = await db.get<VolumeRecord>('volumes', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange(
        'volume',
        id,
        existing.projectId,
        'delete',
        undefined,
        Date.now(),
        0,
        { store: 'volumes', key: id, operation: 'delete', expected: existing },
      )
    }
  },
  deleteVolumeCascade: async (workspaceId: string, volumeId: string, fallbackVolumeId?: string): Promise<DeleteVolumeCascadeResult> => {
    const result: DeleteVolumeCascadeResult = {
      finalWorkspaceRevision: 0,
      migratedChapters: [],
      deletedChapterIds: [],
    }

    await db.runTransaction(['volumes', 'chapters', 'domainChangeSets'], (transaction, fail) => {
      const volumeStore = transaction.objectStore('volumes')
      const chapterStore = transaction.objectStore('chapters')
      const domainStore = transaction.objectStore('domainChangeSets')

      const volumeReq = volumeStore.get(volumeId)
      const chaptersReq = chapterStore.getAll()
      const domainReq = domainStore.getAll()

      let volumeLoaded = false
      let chaptersLoaded = false
      let domainLoaded = false

      let volumeRecord: VolumeRecord | undefined
      let allChapters: ChapterRecord[] | undefined
      let allDomainChanges: any[] | undefined

      const checkReady = () => {
        if (!volumeLoaded || !chaptersLoaded || !domainLoaded) return
        try {
          if (!volumeRecord) {
            // Volume already deleted or doesn't exist
            return
          }

          const now = Date.now()
          const changes: any[] = []
          const relatedChapters = (allChapters || []).filter(
            (ch) => ch.projectId === workspaceId && ch.volumeId === volumeId,
          )

          if (fallbackVolumeId) {
            // Migrate all child chapters to fallback volume
            for (const ch of relatedChapters) {
              const updated: ChapterRecord = {
                ...ch,
                volumeId: fallbackVolumeId,
                updatedAt: now,
              }
              chapterStore.put(updated)
              result.migratedChapters.push(updated)
              changes.push({
                id: `chapter-change-${ch.id}-${ch.revision ?? 0}-${now}`,
                aggregateType: 'chapter',
                aggregateId: ch.id,
                operation: 'upsert',
                revision: ch.revision ?? 0,
                payload: updated,
                occurredAt: now,
              })
            }
          } else {
            // Delete all child chapters
            for (const ch of relatedChapters) {
              chapterStore.delete(ch.id)
              result.deletedChapterIds.push(ch.id)
              changes.push({
                id: `chapter-change-${ch.id}-${ch.revision ?? 0}-${now}`,
                aggregateType: 'chapter',
                aggregateId: ch.id,
                operation: 'delete',
                revision: ch.revision ?? 0,
                occurredAt: now,
              })
            }
          }

          // Delete the volume itself
          volumeStore.delete(volumeId)
          changes.push({
            id: `volume-change-${volumeId}-0-${now}`,
            aggregateType: 'volume',
            aggregateId: volumeId,
            operation: 'delete',
            revision: 0,
            occurredAt: now,
          })

          // Append DomainChangeSet atomically
          const workspaceChanges = (allDomainChanges || [])
            .filter((record: any) => record.workspaceId === workspaceId)
            .sort((a: any, b: any) => a.revision - b.revision)
          const baseRevision = workspaceChanges.at(-1)?.revision ?? 0
          result.finalWorkspaceRevision = baseRevision + 1

          const changeSet = createDomainChangeSet({
            id: `delete-volume-${volumeId}-${now}`,
            workspaceId,
            sourceDeviceId,
            baseRevision,
            changes,
            createdAt: now,
          })

          domainStore.put(changeSet)
        } catch (err) {
          fail(err)
        }
      }

      volumeReq.onsuccess = () => {
        volumeRecord = volumeReq.result
        volumeLoaded = true
        checkReady()
      }
      volumeReq.onerror = () => fail(volumeReq.error)

      chaptersReq.onsuccess = () => {
        allChapters = chaptersReq.result
        chaptersLoaded = true
        checkReady()
      }
      chaptersReq.onerror = () => fail(chaptersReq.error)

      domainReq.onsuccess = () => {
        allDomainChanges = domainReq.result
        domainLoaded = true
        checkReady()
      }
      domainReq.onerror = () => fail(domainReq.error)
    })

    domainChangeEvents.publish(workspaceId, result.finalWorkspaceRevision)
    return result
  },

  getAllChapters: () => db.getAll<ChapterRecord>('chapters'),
  getChaptersByProject: (projectId) =>
    db.getAll<ChapterRecord>('chapters').then((cs) => cs.filter((c) => c.projectId === projectId)),
  saveChapter: async (chapter) => {
    let existing: ChapterRecord | undefined
    if (typeof db.get === 'function') {
      existing = await db.get<ChapterRecord>('chapters', chapter.id).catch(() => undefined)
    }
    if (!existing || JSON.stringify(existing) !== JSON.stringify(chapter)) {
      await appendDomainChange(
        'chapter',
        chapter.id,
        chapter.projectId,
        'upsert',
        chapter,
        chapter.updatedAt,
        chapter.revision ?? 0,
        {
          store: 'chapters',
          key: chapter.id,
          operation: 'upsert',
          value: chapter,
          expected: existing,
        },
      )
    }
    if (existing && existing.wordCount !== chapter.wordCount) {
      const delta = chapter.wordCount - existing.wordCount
      await indexedDbDailyStatsRepository.recordDailyWords(chapter.projectId, delta).catch(() => {})
    } else if (!existing && chapter.wordCount > 0) {
      await indexedDbDailyStatsRepository
        .recordDailyWords(chapter.projectId, chapter.wordCount)
        .catch(() => {})
    }
  },

  saveChapterCAS: async ({ chapter, expectedRevision }) => {
    let current: ChapterRecord | undefined
    if (typeof db.get === 'function') {
      current = await db.get<ChapterRecord>('chapters', chapter.id).catch(() => undefined)
    }

    const currentRev = current?.revision ?? 1
    if (current && currentRev !== expectedRevision) {
      return {
        success: false,
        conflict: true,
        currentRevision: currentRev,
        error: `CAS Conflict: Expected revision ${expectedRevision}, but current database revision is ${currentRev}`,
      }
    }

    await appendDomainChange(
      'chapter',
      chapter.id,
      chapter.projectId,
      'upsert',
      chapter,
      chapter.updatedAt,
      chapter.revision ?? 0,
      {
        store: 'chapters',
        key: chapter.id,
        operation: 'upsert',
        value: chapter,
        expected: current,
      },
    )

    return {
      success: true,
      conflict: false,
      currentRevision: chapter.revision,
    }
  },
  deleteChapter: async (id) => {
    const existing = await db.get<ChapterRecord>('chapters', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange(
        'chapter',
        id,
        existing.projectId,
        'delete',
        undefined,
        Date.now(),
        existing.revision ?? 0,
        { store: 'chapters', key: id, operation: 'delete', expected: existing },
      )
    }
  },
}

async function appendDomainChange(
  aggregateType: string,
  aggregateId: string,
  workspaceId: string,
  operation: 'upsert' | 'delete',
  payload: unknown,
  occurredAt: number,
  aggregateRevision = 0,
  aggregate?: IndexedDbAggregateWrite,
): Promise<void> {
  const operationPromise = domainAppendQueue.then(async () => {
    const baseRevision = await domainChangeStore.latestRevision(workspaceId)
    const changeId = `${aggregateType}-change-${aggregateId}-${aggregateRevision}-${occurredAt}`
    const changeSet = createDomainChangeSet({
      id: `${aggregateType}-${aggregateId}-${aggregateRevision}-${occurredAt}`,
      workspaceId,
      sourceDeviceId,
      baseRevision,
      changes: [
        {
          id: changeId,
          aggregateType,
          aggregateId,
          operation,
          revision: aggregateRevision,
          payload,
          occurredAt,
        },
      ],
      createdAt: occurredAt,
    })
    if (aggregate) await domainChangeStore.appendWithAggregate(changeSet, aggregate)
    else await domainChangeStore.append(changeSet)
    domainChangeEvents.publish(workspaceId, changeSet.baseRevision + 1)
  })
  domainAppendQueue = operationPromise.catch(() => undefined)
  await operationPromise
}
>>>>>>> theirs
