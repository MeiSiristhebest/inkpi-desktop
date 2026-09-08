import { db } from '../db/indexedDB'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import { indexedDbDailyStatsRepository } from './indexedDbDailyStatsRepository'
import { IndexedDbDomainChangeStore } from './indexedDbDomainChangeStore'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'

const domainChangeStore = new IndexedDbDomainChangeStore()
const sourceDeviceId = typeof localStorage === 'undefined'
  ? 'desktop'
  : (localStorage.getItem('inkpi-device-id') || (() => {
      const id = `desktop-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('inkpi-device-id', id)
      return id
    })())

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
      await appendDomainChange('project', project.id, project.id, 'upsert', project, project.updatedAt)
    }
    await db.put('projects', project)
  },
  deleteProject: async (id) => {
    const existing = await db.get<ProjectRecord>('projects', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange('project', id, id, 'delete', undefined, Date.now())
      await db.delete('projects', id)
    }
  },

  getAllVolumes: () => db.getAll<VolumeRecord>('volumes'),
  getVolumesByProject: (projectId) =>
    db.getAll<VolumeRecord>('volumes').then((vs) => vs.filter((v) => v.projectId === projectId)),
  saveVolume: async (volume) => {
    const existing = await db.get<VolumeRecord>('volumes', volume.id).catch(() => undefined)
    if (!existing || JSON.stringify(existing) !== JSON.stringify(volume)) {
      await appendDomainChange('volume', volume.id, volume.projectId, 'upsert', volume, volume.updatedAt)
    }
    await db.put('volumes', volume)
  },
  deleteVolume: async (id) => {
    const existing = await db.get<VolumeRecord>('volumes', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange('volume', id, existing.projectId, 'delete', undefined, Date.now())
      await db.delete('volumes', id)
    }
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
      await appendDomainChange('chapter', chapter.id, chapter.projectId, 'upsert', chapter, chapter.updatedAt, chapter.revision ?? 0)
    }
    await db.put('chapters', chapter)
    if (existing && existing.wordCount !== chapter.wordCount) {
      const delta = chapter.wordCount - existing.wordCount
      await indexedDbDailyStatsRepository.recordDailyWords(chapter.projectId, delta).catch(() => {})
    } else if (!existing && chapter.wordCount > 0) {
      await indexedDbDailyStatsRepository
        .recordDailyWords(chapter.projectId, chapter.wordCount)
        .catch(() => {})
    }
  },
  deleteChapter: async (id) => {
    const existing = await db.get<ChapterRecord>('chapters', id).catch(() => undefined)
    if (existing) {
      await appendDomainChange('chapter', id, existing.projectId, 'delete', undefined, Date.now(), existing.revision ?? 0)
      await db.delete('chapters', id)
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
): Promise<void> {
  const baseRevision = await domainChangeStore.latestRevision(workspaceId)
  const changeId = `${aggregateType}-change-${aggregateId}-${aggregateRevision}-${occurredAt}`
  await domainChangeStore.append(
    createDomainChangeSet({
      id: `${aggregateType}-${aggregateId}-${aggregateRevision}-${occurredAt}`,
      workspaceId,
      sourceDeviceId,
      baseRevision,
      changes: [{
        id: changeId,
        aggregateType,
        aggregateId,
        operation,
        revision: aggregateRevision,
        payload,
        occurredAt,
      }],
      createdAt: occurredAt,
    }),
  )
}
