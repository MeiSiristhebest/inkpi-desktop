import { describe, expect, it, vi } from 'vitest'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { ManuscriptImportPreview } from '../domain/manuscript/importParser'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { createProject, deleteProject } from '../core/projectService'
import { importManuscript } from './manuscriptImportService'

interface MemoryStore {
  projects: Map<string, ProjectRecord>
  volumes: Map<string, VolumeRecord>
  chapters: Map<string, ChapterRecord>
}

function createMemoryRepository(
  seed: {
    projects?: ProjectRecord[]
    volumes?: VolumeRecord[]
    chapters?: ChapterRecord[]
  } = {},
): { repository: ProjectRepository; store: MemoryStore } {
  const store: MemoryStore = {
    projects: new Map((seed.projects ?? []).map((item) => [item.id, item])),
    volumes: new Map((seed.volumes ?? []).map((item) => [item.id, item])),
    chapters: new Map((seed.chapters ?? []).map((item) => [item.id, item])),
  }
  const repository: ProjectRepository = {
    getAllProjects: async () => [...store.projects.values()],
    getProject: async (id) => store.projects.get(id),
    getAllVolumes: async () => [...store.volumes.values()],
    getVolumesByProject: async (projectId) =>
      [...store.volumes.values()].filter((volume) => volume.projectId === projectId),
    getAllChapters: async () => [...store.chapters.values()],
    getChaptersByProject: async (projectId) =>
      [...store.chapters.values()].filter((chapter) => chapter.projectId === projectId),
    saveProject: async (project) => {
      store.projects.set(project.id, project)
    },
    deleteProject: async (id) => {
      store.projects.delete(id)
    },
    saveVolume: async (volume) => {
      store.volumes.set(volume.id, volume)
    },
    deleteVolume: async (id) => {
      store.volumes.delete(id)
    },
    saveChapter: async (chapter) => {
      store.chapters.set(chapter.id, chapter)
    },
    deleteChapter: async (id) => {
      store.chapters.delete(id)
    },
  }
  return { repository, store }
}

function project(id = 'project-1'): ProjectRecord {
  return { id, name: '已有作品', createdAt: 1, updatedAt: 1 }
}

function volume(id = 'volume-1', projectId = 'project-1', order = 1): VolumeRecord {
  return { id, projectId, title: '第一卷', order, createdAt: 1, updatedAt: 1 }
}

function preview(): ManuscriptImportPreview {
  return {
    fileName: '源稿.txt',
    format: 'txt',
    warnings: [],
    volumes: [
      {
        sourceKey: 'source-volume-1',
        title: '源卷一',
        chapters: [
          { sourceKey: 'chapter-1', title: '第一章', content: '第一段\n第二行', included: true },
          { sourceKey: 'chapter-2', title: '不导入', content: '跳过', included: false },
        ],
      },
      {
        sourceKey: 'source-volume-2',
        title: '源卷二',
        chapters: [
          { sourceKey: 'chapter-3', title: '第二章', content: '<b>危险</b>', included: true },
        ],
      },
    ],
  }
}

function fixedIds() {
  let sequence = 0
  return { generate: (prefix: string) => `${prefix}-import-${++sequence}` }
}

const fixedClock = { now: () => 100 }

describe('importManuscript', () => {
  it('appends selected chapters to an existing volume without changing existing records', async () => {
    const currentProject = project()
    const currentVolume = volume()
    const existingChapter: ChapterRecord = {
      id: 'existing-chapter',
      projectId: currentProject.id,
      volumeId: currentVolume.id,
      title: '旧章节',
      content: '<p>原文</p>',
      wordCount: 2,
      order: 4,
      status: 'published',
      createdAt: 1,
      updatedAt: 1,
    }
    const { repository, store } = createMemoryRepository({
      projects: [currentProject],
      volumes: [currentVolume],
      chapters: [existingChapter],
    })
    const onProgress = vi.fn()

    const result = await importManuscript(
      preview(),
      { kind: 'existing-volume', projectId: currentProject.id, volumeId: currentVolume.id },
      onProgress,
      { repository, idGenerator: fixedIds(), clock: fixedClock },
    )

    const imported = [...store.chapters.values()].filter(
      (chapter) => chapter.id !== existingChapter.id,
    )
    expect(result).toMatchObject({
      projectId: currentProject.id,
      projectName: currentProject.name,
      chapterCount: 2,
      volumeTitles: [currentVolume.title],
    })
    expect(imported).toHaveLength(2)
    expect(imported.map((chapter) => chapter.order)).toEqual([5, 6])
    expect(imported.every((chapter) => chapter.volumeId === currentVolume.id)).toBe(true)
    expect(imported[0]).toMatchObject({ title: '第一章', status: 'draft', wordCount: 6 })
    expect(imported[1].content).toContain('&lt;b&gt;危险&lt;/b&gt;')
    expect(store.chapters.get(existingChapter.id)).toEqual(existingChapter)
    expect(onProgress).toHaveBeenNthCalledWith(1, { completedChapters: 0, totalChapters: 2 })
    expect(onProgress).toHaveBeenLastCalledWith({ completedChapters: 2, totalChapters: 2 })
  })

  it('creates one new volume per selected source volume and appends after existing volumes', async () => {
    const currentProject = project()
    const currentVolume = volume()
    const { repository, store } = createMemoryRepository({
      projects: [currentProject],
      volumes: [currentVolume],
    })

    const result = await importManuscript(
      preview(),
      { kind: 'new-volumes', projectId: currentProject.id },
      undefined,
      { repository, idGenerator: fixedIds(), clock: fixedClock },
    )

    const createdVolumes = [...store.volumes.values()]
      .filter((item) => item.id !== currentVolume.id)
      .sort((left, right) => left.order - right.order)
    expect(createdVolumes.map(({ title, order }) => ({ title, order }))).toEqual([
      { title: '源卷一', order: 2 },
      { title: '源卷二', order: 3 },
    ])
    expect(
      [...store.chapters.values()].map(({ volumeId, title, order }) => ({
        volumeId,
        title,
        order,
      })),
    ).toEqual([
      { volumeId: createdVolumes[0].id, title: '第一章', order: 1 },
      { volumeId: createdVolumes[1].id, title: '第二章', order: 1 },
    ])
    expect(result.volumeTitles).toEqual(['源卷一', '源卷二'])
  })

  it('creates a blank project, reuses its empty starter chapter and preserves source volumes', async () => {
    const { repository, store } = createMemoryRepository()
    const createdProject = project('new-project')
    const starterVolume = volume('starter-volume', createdProject.id)
    const starterChapter: ChapterRecord = {
      id: 'starter-chapter',
      projectId: createdProject.id,
      volumeId: starterVolume.id,
      title: '第1章',
      content: '<p></p>',
      wordCount: 0,
      order: 1,
      status: 'draft',
      createdAt: 10,
      updatedAt: 10,
    }
    const createProject = vi.fn(async () => {
      await repository.saveProject(createdProject)
      await repository.saveVolume({ ...starterVolume, title: '正文卷' })
      await repository.saveChapter(starterChapter)
      return createdProject
    })
    const deleteProject = vi.fn(async (id: string) => {
      store.projects.delete(id)
      for (const [key, item] of store.volumes) if (item.projectId === id) store.volumes.delete(key)
      for (const [key, item] of store.chapters)
        if (item.projectId === id) store.chapters.delete(key)
    })

    const result = await importManuscript(
      preview(),
      { kind: 'new-project', projectName: '新作品', genre: '科幻' },
      undefined,
      { repository, createProject, deleteProject, idGenerator: fixedIds(), clock: fixedClock },
    )

    expect(createProject).toHaveBeenCalledWith({
      name: '新作品',
      genre: '科幻',
      cover: '',
      starter: 'blank',
      tooling: 'recommended',
      customPluginIds: [],
    })
    expect(result).toMatchObject({ projectId: createdProject.id, chapterCount: 2 })
    expect(store.volumes.get(starterVolume.id)?.title).toBe('源卷一')
    expect(store.chapters.get(starterChapter.id)).toMatchObject({
      title: '第一章',
      volumeId: starterVolume.id,
      content: '<p>第一段<br>第二行</p>',
      revision: 1,
    })
    expect(
      [...store.chapters.values()].filter((chapter) => chapter.projectId === createdProject.id),
    ).toHaveLength(2)
    expect(deleteProject).not.toHaveBeenCalled()
  })

  it('persists a new-project import through the real IndexedDB repository and cleans it up', async () => {
    const result = await importManuscript(
      preview(),
      { kind: 'new-project', projectName: 'Manuscript import integration', genre: '' },
      undefined,
      {
        repository: indexedDbProjectRepository,
        createProject,
        deleteProject,
      },
    )

    try {
      const [storedProject, storedVolumes, storedChapters] = await Promise.all([
        indexedDbProjectRepository.getProject(result.projectId),
        indexedDbProjectRepository.getVolumesByProject(result.projectId),
        indexedDbProjectRepository.getChaptersByProject(result.projectId),
      ])
      expect(storedProject?.name).toBe('Manuscript import integration')
      expect(storedVolumes.map((item) => item.title)).toEqual(['源卷一', '源卷二'])
      expect(storedChapters.map((item) => item.title)).toEqual(['第一章', '第二章'])
      expect(storedChapters.every((item) => item.status === 'draft')).toBe(true)
    } finally {
      await deleteProject(result.projectId)
    }
  })

  it('rolls back all added chapters when a write fails for an existing project', async () => {
    const currentProject = project()
    const currentVolume = volume()
    const existingChapter: ChapterRecord = {
      id: 'existing-chapter',
      projectId: currentProject.id,
      volumeId: currentVolume.id,
      title: '保留章节',
      content: '<p>原文</p>',
      wordCount: 2,
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    const { repository, store } = createMemoryRepository({
      projects: [currentProject],
      volumes: [currentVolume],
      chapters: [existingChapter],
    })
    const saveChapter = repository.saveChapter.bind(repository)
    repository.saveChapter = async (chapter) => {
      if (chapter.title === '第二章') throw new Error('write failed')
      await saveChapter(chapter)
    }

    await expect(
      importManuscript(
        preview(),
        { kind: 'existing-volume', projectId: currentProject.id, volumeId: currentVolume.id },
        undefined,
        { repository, idGenerator: fixedIds(), clock: fixedClock },
      ),
    ).rejects.toThrow('write failed')

    expect([...store.chapters.values()]).toEqual([existingChapter])
    expect([...store.volumes.values()]).toEqual([currentVolume])
  })

  it('rejects a selection that contains no chapters before touching storage', async () => {
    const { repository } = createMemoryRepository({ projects: [project()], volumes: [volume()] })
    const emptyPreview: ManuscriptImportPreview = {
      ...preview(),
      volumes: preview().volumes.map((item) => ({
        ...item,
        chapters: item.chapters.map((chapter) => ({ ...chapter, included: false })),
      })),
    }

    await expect(
      importManuscript(
        emptyPreview,
        { kind: 'existing-volume', projectId: 'project-1', volumeId: 'volume-1' },
        undefined,
        { repository },
      ),
    ).rejects.toThrow('请至少选择一个要导入的章节。')
  })
})
