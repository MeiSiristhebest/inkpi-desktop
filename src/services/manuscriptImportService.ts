import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import type { NewProjectForm } from '../domain/project/projectDefaults'
import type { ManuscriptImportPreview } from '../domain/manuscript/importParser'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { idGenerator as defaultIdGenerator } from '../adapters/idGenerator'
import { clock as defaultClock } from '../adapters/clock'
import { countWords, htmlToPlain } from '../domain/text'
import { plainTextToEditorHtml } from '../domain/manuscript/plainTextToEditorHtml'

export type ManuscriptImportDestination =
  | { kind: 'existing-volume'; projectId: string; volumeId: string }
  | { kind: 'new-volumes'; projectId: string }
  | { kind: 'new-project'; projectName: string; genre: string }

export interface ManuscriptImportProgress {
  completedChapters: number
  totalChapters: number
}

export interface ManuscriptImportResult {
  projectId: string
  projectName: string
  chapterCount: number
  volumeTitles: string[]
}

export interface ManuscriptImportDependencies {
  repository?: ProjectRepository
  createProject?: (form: NewProjectForm) => Promise<ProjectRecord>
  deleteProject?: (projectId: string) => Promise<void>
  idGenerator?: IdGenerator
  clock?: Clock
}

interface ImportGroup {
  title: string
  chapters: ManuscriptImportPreview['volumes'][number]['chapters']
}

const CHAPTER_BATCH_SIZE = 25

function normalizedTitle(value: string, fallback: string): string {
  return (
    value
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 200) || fallback
  )
}

function makeNewChapter(
  projectId: string,
  volumeId: string,
  title: string,
  text: string,
  order: number,
  now: number,
  idGenerator: IdGenerator,
): ChapterRecord {
  const content = plainTextToEditorHtml(text)
  return {
    id: idGenerator.generate('ch'),
    projectId,
    volumeId,
    title: normalizedTitle(title, `第${order}章`),
    content,
    wordCount: countWords(htmlToPlain(content)),
    order,
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function nextTimestamp(clock: Clock, previous = 0): number {
  return Math.max(clock.now(), previous + 1)
}

function selectedGroups(preview: ManuscriptImportPreview): ImportGroup[] {
  return preview.volumes
    .map((volume, index) => ({
      title: normalizedTitle(volume.title, `第${index + 1}卷`),
      chapters: volume.chapters.filter((chapter) => chapter.included),
    }))
    .filter((volume) => volume.chapters.length > 0)
}

function selectedChapterCount(groups: ImportGroup[]): number {
  return groups.reduce((count, group) => count + group.chapters.length, 0)
}

function reportProgress(
  callback: ((progress: ManuscriptImportProgress) => void) | undefined,
  completedChapters: number,
  totalChapters: number,
): void {
  callback?.({ completedChapters, totalChapters })
}

async function persistChapterBatches(
  repository: ProjectRepository,
  chapters: ChapterRecord[],
  createdChapterIds: string[],
  progress: (completed: number) => void,
): Promise<void> {
  for (let offset = 0; offset < chapters.length; offset += CHAPTER_BATCH_SIZE) {
    const batch = chapters.slice(offset, offset + CHAPTER_BATCH_SIZE)
    createdChapterIds.push(...batch.map((chapter) => chapter.id))
    const results = await Promise.allSettled(
      batch.map((chapter) => repository.saveChapter(chapter)),
    )
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    progress(batch.length)
  }
}

async function rollbackExistingProject(
  repository: ProjectRepository,
  chapterIds: string[],
  volumeIds: string[],
): Promise<void> {
  const failures: unknown[] = []
  for (const id of [...chapterIds].reverse()) {
    try {
      await repository.deleteChapter(id)
    } catch (error) {
      failures.push(error)
    }
  }
  for (const id of [...volumeIds].reverse()) {
    try {
      await repository.deleteVolume(id)
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      'Could not remove every partially imported chapter and volume.',
    )
  }
}

function newProjectForm(projectName: string, genre: string): NewProjectForm {
  return {
    name: projectName,
    genre: genre.trim() || '未分类',
    cover: '',
    starter: 'blank',
    tooling: 'recommended',
    customPluginIds: [],
  }
}

/** Import selected manuscript chapters into the chosen project/volume boundary. */
export async function importManuscript(
  preview: ManuscriptImportPreview,
  destination: ManuscriptImportDestination,
  onProgress?: (progress: ManuscriptImportProgress) => void,
  dependencies: ManuscriptImportDependencies = {},
): Promise<ManuscriptImportResult> {
  const repository = dependencies.repository ?? indexedDbProjectRepository
  const createProject = dependencies.createProject
  const deleteProject = dependencies.deleteProject
  const idGenerator = dependencies.idGenerator ?? defaultIdGenerator
  const clock = dependencies.clock ?? defaultClock
  const groups = selectedGroups(preview)
  const totalChapters = selectedChapterCount(groups)
  if (totalChapters === 0) throw new Error('请至少选择一个要导入的章节。')

  const createdChapterIds: string[] = []
  const createdVolumeIds: string[] = []
  let createdProjectId: string | undefined
  let completedChapters = 0
  const report = (batchSize: number) => {
    completedChapters += batchSize
    reportProgress(onProgress, completedChapters, totalChapters)
  }
  reportProgress(onProgress, 0, totalChapters)

  try {
    if (destination.kind === 'new-project') {
      if (!createProject || !deleteProject) {
        throw new Error('新建项目导入需要配置项目创建与清理服务。')
      }
      const fallbackName = preview.fileName.replace(/\.[^.]+$/, '').trim() || '导入稿件'
      const projectName = normalizedTitle(destination.projectName, fallbackName)
      const project = await createProject(newProjectForm(projectName, destination.genre))
      createdProjectId = project.id

      const [volumes, chapters] = await Promise.all([
        repository.getVolumesByProject(project.id),
        repository.getChaptersByProject(project.id),
      ])
      let currentVolume = [...volumes].sort((a, b) => a.order - b.order)[0]
      const firstGroup = groups[0]
      if (!firstGroup) throw new Error('没有可导入的章节。')

      if (!currentVolume) {
        const now = clock.now()
        currentVolume = {
          id: idGenerator.generate('vol'),
          projectId: project.id,
          title: firstGroup.title,
          order: 1,
          createdAt: now,
          updatedAt: now,
        }
        await repository.saveVolume(currentVolume)
      } else if (currentVolume.title !== firstGroup.title) {
        currentVolume = {
          ...currentVolume,
          title: firstGroup.title,
          updatedAt: nextTimestamp(clock, currentVolume.updatedAt),
        }
        await repository.saveVolume(currentVolume)
      }

      let nextVolumeOrder = Math.max(0, ...volumes.map((volume) => volume.order)) + 1
      for (const [groupIndex, group] of groups.entries()) {
        let volume: VolumeRecord
        if (groupIndex === 0) {
          volume = currentVolume
        } else {
          const now = clock.now()
          volume = {
            id: idGenerator.generate('vol'),
            projectId: project.id,
            title: group.title,
            order: nextVolumeOrder++,
            createdAt: now,
            updatedAt: now,
          }
          createdVolumeIds.push(volume.id)
          await repository.saveVolume(volume)
        }

        const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volume.id)
        const blankChapter =
          groupIndex === 0
            ? volumeChapters.find(
                (chapter) => chapter.wordCount === 0 && !htmlToPlain(chapter.content || '').trim(),
              )
            : undefined
        const otherOrders = volumeChapters
          .filter((chapter) => chapter.id !== blankChapter?.id)
          .map((chapter) => chapter.order)
        let nextChapterOrder = Math.max(0, ...otherOrders) + 1
        const chapterRecords = group.chapters.map((chapter, chapterIndex) => {
          if (chapterIndex === 0 && blankChapter) {
            const content = plainTextToEditorHtml(chapter.content)
            const record: ChapterRecord = {
              ...blankChapter,
              title: normalizedTitle(chapter.title, `第${chapterIndex + 1}章`),
              content,
              wordCount: countWords(htmlToPlain(content)),
              order: nextChapterOrder++,
              status: 'draft',
              revision: (blankChapter.revision ?? 0) + 1,
              updatedAt: nextTimestamp(clock, blankChapter.updatedAt),
            }
            return record
          }
          const order = nextChapterOrder++
          return makeNewChapter(
            project.id,
            volume.id,
            chapter.title,
            chapter.content,
            order,
            clock.now(),
            idGenerator,
          )
        })
        await persistChapterBatches(repository, chapterRecords, createdChapterIds, report)
      }

      return {
        projectId: project.id,
        projectName: project.name,
        chapterCount: totalChapters,
        volumeTitles: groups.map((group) => group.title),
      }
    }

    const project = await repository.getProject(destination.projectId)
    if (!project) throw new Error('目标作品不存在，可能已被删除。')
    if (project.archivedAt) throw new Error('目标作品已移出作品库，请先恢复到作品库。')

    const [volumes, chapters] = await Promise.all([
      repository.getVolumesByProject(project.id),
      repository.getChaptersByProject(project.id),
    ])

    if (destination.kind === 'existing-volume') {
      const volume = volumes.find((candidate) => candidate.id === destination.volumeId)
      if (!volume) throw new Error('所选分卷不属于目标作品，未导入任何内容。')
      let nextOrder =
        Math.max(
          0,
          ...chapters
            .filter((chapter) => chapter.volumeId === volume.id)
            .map((chapter) => chapter.order),
        ) + 1
      const chapterRecords = groups.flatMap((group) =>
        group.chapters.map((chapter) => {
          const order = nextOrder++
          return makeNewChapter(
            project.id,
            volume.id,
            chapter.title,
            chapter.content,
            order,
            clock.now(),
            idGenerator,
          )
        }),
      )
      await persistChapterBatches(repository, chapterRecords, createdChapterIds, report)
      return {
        projectId: project.id,
        projectName: project.name,
        chapterCount: totalChapters,
        volumeTitles: [volume.title],
      }
    }

    let nextVolumeOrder = Math.max(0, ...volumes.map((volume) => volume.order)) + 1
    for (const group of groups) {
      const now = clock.now()
      const volume: VolumeRecord = {
        id: idGenerator.generate('vol'),
        projectId: project.id,
        title: group.title,
        order: nextVolumeOrder++,
        createdAt: now,
        updatedAt: now,
      }
      createdVolumeIds.push(volume.id)
      await repository.saveVolume(volume)
      const chapterRecords = group.chapters.map((chapter, chapterIndex) =>
        makeNewChapter(
          project.id,
          volume.id,
          chapter.title,
          chapter.content,
          chapterIndex + 1,
          clock.now(),
          idGenerator,
        ),
      )
      await persistChapterBatches(repository, chapterRecords, createdChapterIds, report)
    }

    return {
      projectId: project.id,
      projectName: project.name,
      chapterCount: totalChapters,
      volumeTitles: groups.map((group) => group.title),
    }
  } catch (error) {
    try {
      if (createdProjectId) {
        if (!deleteProject) throw new Error('新建项目导入清理服务不可用。')
        await deleteProject(createdProjectId)
      } else {
        await rollbackExistingProject(repository, createdChapterIds, createdVolumeIds)
      }
    } catch (cleanupError) {
      throw new Error(
        `稿件导入失败，且未能完全回滚部分数据：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        { cause: error },
      )
    }
    throw error
  }
}
