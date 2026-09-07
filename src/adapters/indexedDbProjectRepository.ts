import { db } from '../db/indexedDB'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import { indexedDbDailyStatsRepository } from './indexedDbDailyStatsRepository'

/**
 * IndexedDB 项目仓储适配器：把端口方法映射到 inkpi-studio 数据库的具体 CRUD。
 * 这是唯一直接接触 IndexedDB 实现细节的地方；业务层不会直接 import db。
 */
export const indexedDbProjectRepository: ProjectRepository = {
  getAllProjects: () => db.getAll<ProjectRecord>('projects'),
  getProject: (id) => db.get<ProjectRecord>('projects', id),
  saveProject: (project) => db.put('projects', project),
  deleteProject: (id) => db.delete('projects', id),

  getAllVolumes: () => db.getAll<VolumeRecord>('volumes'),
  getVolumesByProject: (projectId) =>
    db.getAll<VolumeRecord>('volumes').then((vs) => vs.filter((v) => v.projectId === projectId)),
  saveVolume: (volume) => db.put('volumes', volume),
  deleteVolume: (id) => db.delete('volumes', id),

  getAllChapters: () => db.getAll<ChapterRecord>('chapters'),
  getChaptersByProject: (projectId) =>
    db.getAll<ChapterRecord>('chapters').then((cs) => cs.filter((c) => c.projectId === projectId)),
  saveChapter: async (chapter) => {
    let existing: ChapterRecord | undefined
    if (typeof db.get === 'function') {
      existing = await db.get<ChapterRecord>('chapters', chapter.id).catch(() => undefined)
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
  deleteChapter: (id) => db.delete('chapters', id),
}
