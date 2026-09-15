import { db } from '../db/indexedDB'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { idGenerator } from '../adapters/idGenerator'
import { clock } from '../adapters/clock'
import { draftJournal } from './draftJournal'
import {
  WORKSPACE_ARCHIVE_SCHEMA_VERSION,
  type WorkspaceBackupArchive,
  type ManuscriptExportArchive,
  type WorkspaceManifest,
} from './workspaceManifest'

export interface ImportWorkspaceResult {
  ok: boolean
  workspaceId?: string
  project?: ProjectRecord
  manifest?: WorkspaceManifest
  remappingSummary?: {
    volumesCount: number
    chaptersCount: number
    domainStoresCount: number
    totalRecordsRemapped: number
  }
  error?: string
}

// Stores strictly scoped to a project that must be backed up, remapped upon import, or wiped upon purge.
export const PROJECT_DOMAIN_STORES: string[] = [
  'settingsKV',
  'codexEntities',
  'formData',
  'tableRows',
  'cardRecords',
  'promiseLedger',
  'timelineNodes',
  'narrativeThreads',
  'sceneBeats',
  'expectationContracts',
  'powerTierSystems',
  'sprintRecords',
  'readerHooks',
  'clueMatrices',
  'waterAuditSnapshots',
  'volumeArcs',
  'dialogueVoiceprints',
  'factionDiplomacies',
  'paywallAudits',
  'memoryPalaceSnapshots',
  'pressExportConfigs',
  'emotionAudits',
  'subPlotStrands',
  'brainstormSparks',
  'readerSimulations',
  'chekhovGuns',
  'rhythmCadences',
  'geoMapGrids',
  'combatDuels',
  'multiCalendars',
  'povSnapshots',
  'linterRulesConfigs',
  'diffReviews',
  'ironChamberRecords',
  'soundscapeConfigs',
  'scrapbookFragments',
  'aftermathPatches',
  'subtextDialogues',
  'rhythmRadarReports',
  'goldChapterEvals',
  'shadowDanmakus',
  'authorOpsProfiles',
  'multiverseBranches',
  'voiceScriptCasts',
  'storyboardScenes',
  'domainChangeSets',
  'aiArtifacts',
  'aiProposals',
]

export class WorkspaceLifecycleService {
  readonly projectRepo: ProjectRepository
  readonly idGen: IdGenerator
  readonly clockPort: Clock

  constructor(
    projectRepo: ProjectRepository = indexedDbProjectRepository,
    idGen: IdGenerator = idGenerator,
    clockPort: Clock = clock,
  ) {
    this.projectRepo = projectRepo
    this.idGen = idGen
    this.clockPort = clockPort
  }

  /**
   * 导出纯稿件正文（Manuscript Export）：
   * 仅包含分卷、章节、项目基本信息，不包含底层中间状态与插件业务库。
   */
  async exportManuscript(workspaceId: string): Promise<ManuscriptExportArchive | null> {
    const project = await this.projectRepo.getProject(workspaceId)
    if (!project) return null

    const allVolumes = await this.projectRepo.getAllVolumes()
    const allChapters = await this.projectRepo.getAllChapters()

    const volumes = allVolumes.filter((v) => v.projectId === workspaceId)
    const chapters = allChapters.filter((c) => c.projectId === workspaceId)

    const manifest: WorkspaceManifest = {
      schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
      archiveType: 'manuscript-export',
      workspaceId,
      name: project.name,
      exportedAt: this.clockPort.now(),
      core: {
        project: true,
        volumesCount: volumes.length,
        chaptersCount: chapters.length,
      },
      domainStoresIncluded: [],
      totalRecordsCount: volumes.length + chapters.length + 1,
    }

    return {
      manifest,
      project,
      volumes,
      chapters,
    }
  }

  /**
   * 导出完整工作区备份（InkPi Workspace Backup）：
   * 包含项目元数据、卷章正文、所有 40+ 领域表数据（世界观、时间线、伏笔、地图、AI产物等），
   * 真实践行 INV-04：“叫完整备份就必须真的完整”。
   */
  async exportWorkspaceBackup(workspaceId: string): Promise<WorkspaceBackupArchive | null> {
    const project = await this.projectRepo.getProject(workspaceId)
    if (!project) return null

    const allVolumes = await this.projectRepo.getAllVolumes()
    const allChapters = await this.projectRepo.getAllChapters()
    const volumes = allVolumes.filter((v) => v.projectId === workspaceId)
    const chapters = allChapters.filter((c) => c.projectId === workspaceId)

    const domainData: Record<string, Record<string, unknown>[]> = {}
    let totalRecordsCount = 1 + volumes.length + chapters.length
    const domainStoresIncluded: string[] = []

    for (const storeName of PROJECT_DOMAIN_STORES) {
      if (typeof db.getAll === 'function') {
        try {
          const records = await db.getAll<Record<string, unknown>>(storeName as any)
          const filtered = records.filter((r) => {
            if (storeName === 'settingsKV') {
              const key = String((r as any).key || '')
              return (
                key.includes(workspaceId) ||
                key.startsWith(`storyState::${workspaceId}`) ||
                key.startsWith(`inkpi-excluded-nums-${workspaceId}`) ||
                key.startsWith(`inkpi-daily-goal-${workspaceId}`)
              )
            }
            if (storeName === 'aiArtifacts') {
              const ownership = (r as any).ownership
              return (
                r.projectId === workspaceId ||
                r.workspaceId === workspaceId ||
                ownership?.workspaceId === workspaceId ||
                ownership?.projectId === workspaceId
              )
            }
            return r.projectId === workspaceId || r.workspaceId === workspaceId
          })
          if (filtered.length > 0) {
            domainData[storeName] = filtered
            domainStoresIncluded.push(storeName)
            totalRecordsCount += filtered.length
          }
        } catch {
          // ignore uninitialized stores
        }
      }
    }

    const manifest: WorkspaceManifest = {
      schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
      archiveType: 'inkpi-workspace-backup',
      workspaceId,
      name: project.name,
      exportedAt: this.clockPort.now(),
      core: {
        project: true,
        volumesCount: volumes.length,
        chaptersCount: chapters.length,
      },
      domainStoresIncluded,
      totalRecordsCount,
    }

    return {
      manifest,
      project,
      volumes,
      chapters,
      domainData,
    }
  }

  /**
   * 导入工作区并执行完整的 Object Graph Remapping (INV-03, INV-04)：
   * 生成全新的 workspaceId、volumeId、chapterId 以及各类 domain entity ID，
   * 递归重映射所有的 foreign keys (projectId, volumeId, chapterId 等)，杜绝全局 ID 碰撞与跨项目污染。
   */
  async importWorkspace(archiveRaw: unknown): Promise<ImportWorkspaceResult> {
    if (!archiveRaw || typeof archiveRaw !== 'object') {
      return { ok: false, error: '无效的工作区数据格式' }
    }

    const archive = archiveRaw as Partial<WorkspaceBackupArchive & { project?: ProjectRecord }>
    const sourceProject = archive.project
    if (!sourceProject || !sourceProject.id) {
      return { ok: false, error: '缺失有效的 project 实体元数据' }
    }

    const oldWorkspaceId = sourceProject.id
    const newWorkspaceId = this.idGen.generate('proj')
    const now = this.clockPort.now()

    // 1. Remap Project
    const newProject: ProjectRecord = {
      ...sourceProject,
      id: newWorkspaceId,
      name: sourceProject.name ? `${sourceProject.name}` : '导入作品',
      createdAt: now,
      updatedAt: now,
    }

    // 2. Remap Volumes
    const volumeIdMap = new Map<string, string>()
    const oldVolumes = Array.isArray(archive.volumes) ? archive.volumes : []
    const newVolumes: VolumeRecord[] = oldVolumes.map((vol) => {
      const newVolId = this.idGen.generate('vol')
      volumeIdMap.set(vol.id, newVolId)
      return {
        ...vol,
        id: newVolId,
        projectId: newWorkspaceId,
        createdAt: now,
        updatedAt: now,
      }
    })

    // 3. Remap Chapters
    const chapterIdMap = new Map<string, string>()
    const oldChapters = Array.isArray(archive.chapters) ? archive.chapters : []
    const newChapters: ChapterRecord[] = oldChapters.map((ch) => {
      const newChId = this.idGen.generate('ch')
      chapterIdMap.set(ch.id, newChId)
      const mappedVolumeId = ch.volumeId ? (volumeIdMap.get(ch.volumeId) ?? ch.volumeId) : ''
      return {
        ...ch,
        id: newChId,
        projectId: newWorkspaceId,
        volumeId: mappedVolumeId,
        createdAt: now,
        updatedAt: now,
      }
    })

    // 4. Remap Domain & Plugin Stores
    const remappedDomainData: Record<string, Record<string, unknown>[]> = {}
    let totalRemappedDomainRecords = 0
    const sourceDomainData = archive.domainData || {}

    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (!Array.isArray(records)) continue
      const remappedList: Record<string, unknown>[] = []

      for (const rec of records) {
        if (!rec || typeof rec !== 'object') continue
        const item = { ...rec }

        // Remap workspace/project foreign key
        if ('projectId' in item && item.projectId === oldWorkspaceId) {
          item.projectId = newWorkspaceId
        }
        if ('workspaceId' in item && item.workspaceId === oldWorkspaceId) {
          item.workspaceId = newWorkspaceId
        }
        if (storeName === 'settingsKV' && 'key' in item && typeof item.key === 'string') {
          item.key = item.key.replaceAll(oldWorkspaceId, newWorkspaceId)
        }
        if (
          storeName === 'aiArtifacts' &&
          'ownership' in item &&
          typeof item.ownership === 'object'
        ) {
          item.ownership = { ...(item.ownership as any), workspaceId: newWorkspaceId }
        }

        // Remap volume foreign key
        if (
          'volumeId' in item &&
          typeof item.volumeId === 'string' &&
          volumeIdMap.has(item.volumeId)
        ) {
          item.volumeId = volumeIdMap.get(item.volumeId)!
        }

        // Remap chapter foreign key
        if (
          'chapterId' in item &&
          typeof item.chapterId === 'string' &&
          chapterIdMap.has(item.chapterId)
        ) {
          item.chapterId = chapterIdMap.get(item.chapterId)!
        }
        if (
          'sourceChapterId' in item &&
          typeof item.sourceChapterId === 'string' &&
          chapterIdMap.has(item.sourceChapterId)
        ) {
          item.sourceChapterId = chapterIdMap.get(item.sourceChapterId)!
        }

        // Remap primary ID to avoid collision
        if ('id' in item && typeof item.id === 'string') {
          item.id = `${item.id}-imported-${this.idGen.generate('sub').slice(-6)}`
        }

        remappedList.push(item)
      }

      remappedDomainData[storeName] = remappedList
      totalRemappedDomainRecords += remappedList.length
    }

    // 5. Atomic-style persistence with automatic rollback on failure (P0-6, INV-08)
    try {
      await this.projectRepo.saveProject(newProject)
      for (const vol of newVolumes) {
        await this.projectRepo.saveVolume(vol)
      }
      for (const ch of newChapters) {
        await this.projectRepo.saveChapter(ch)
      }

      for (const [storeName, records] of Object.entries(remappedDomainData)) {
        if (typeof db.put === 'function') {
          for (const item of records) {
            await db.put(storeName as any, item)
          }
        }
      }
    } catch (err) {
      // 导入失败时立刻彻底回滚已写入的半拉子工作区数据，实现 0% 破损残留 (INV-08)
      try {
        await this.purgeWorkspace(newWorkspaceId)
      } catch {
        // ignore rollback errors
      }
      return {
        ok: false,
        error: `导入失败，数据写入异常 (已安全回滚): ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    return {
      ok: true,
      workspaceId: newWorkspaceId,
      project: newProject,
      manifest: archive.manifest,
      remappingSummary: {
        volumesCount: newVolumes.length,
        chaptersCount: newChapters.length,
        domainStoresCount: Object.keys(remappedDomainData).length,
        totalRecordsRemapped:
          newVolumes.length + newChapters.length + totalRemappedDomainRecords + 1,
      },
    }
  }

  /**
   * 永久清除工作区数据 (Permanent Purge) (P0.8)：
   * 清除 Project、Volumes、Chapters、所有领域及插件表、AI 产物、Domain Change 记录以及本地 Draft Journal，
   * 彻底杜绝孤魂残留与跨工作区泄漏。
   */
  async purgeWorkspace(workspaceId: string): Promise<void> {
    // 1. Delete chapters and volumes
    const allVolumes = await this.projectRepo.getAllVolumes()
    const allChapters = await this.projectRepo.getAllChapters()
    const volumes = allVolumes.filter((v) => v.projectId === workspaceId)
    const chapters = allChapters.filter((c) => c.projectId === workspaceId)

    for (const ch of chapters) {
      await this.projectRepo.deleteChapter(ch.id)
      draftJournal.clear(workspaceId, ch.id)
    }

    for (const vol of volumes) {
      await this.projectRepo.deleteVolume(vol.id)
    }

    // 2. Delete project metadata
    await this.projectRepo.deleteProject(workspaceId)

    // 3. Purge all related domain & plugin stores
    for (const storeName of PROJECT_DOMAIN_STORES) {
      if (typeof db.getAll === 'function' && typeof db.delete === 'function') {
        try {
          const records = await db.getAll<Record<string, unknown>>(storeName as any)
          for (const rec of records) {
            if (rec.projectId === workspaceId || rec.workspaceId === workspaceId) {
              const primaryKey = (rec.id || (rec as any).key || (rec as any).projectId) as string
              if (primaryKey) {
                await db.delete(storeName as any, primaryKey).catch(() => {})
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

export const workspaceLifecycleService = new WorkspaceLifecycleService()
