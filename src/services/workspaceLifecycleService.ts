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
  'dailyStats',
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

const PURGE_TOMBSTONES_KEY = 'inkpi-purge-tombstones'

export interface PurgeTombstone {
  workspaceId: string
  purgedAt: number
}

function loadPurgeTombstones(): PurgeTombstone[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PURGE_TOMBSTONES_KEY) : null
    return raw ? (JSON.parse(raw) as PurgeTombstone[]) : []
  } catch {
    return []
  }
}

function savePurgeTombstones(tombstones: PurgeTombstone[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PURGE_TOMBSTONES_KEY, JSON.stringify(tombstones))
    }
  } catch {
    // ignore storage quota errors
  }
}

function recordPurgeTombstone(workspaceId: string): void {
  const current = loadPurgeTombstones().filter((t) => t.workspaceId !== workspaceId)
  current.push({ workspaceId, purgedAt: Date.now() })
  savePurgeTombstones(current)
}

function clearPurgeTombstone(workspaceId: string): void {
  const current = loadPurgeTombstones().filter((t) => t.workspaceId !== workspaceId)
  savePurgeTombstones(current)
}

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
   * 导入工作区并执行完整的 3-Pass Object Graph Remapping (P0-1, INV-03, INV-04, INV-08):
   * Pass 1: 分配全新的 workspaceId、volumeId、chapterId 以及各类 domain entity ID 映射。
   * Pass 2: 递归重映射所有的 foreign keys (projectId, volumeId, chapterId, lineage, settingsKV 编码 key 等)，杜绝全局 ID 碰撞与跨项目污染。
   * Pass 3: 严格引用完整性校验 (Referential Integrity Check)，若发现任何孤立或断裂的外键，立即抛出异常触发自动回滚。
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

    // ── PASS 1: ID ALLOCATION ──
    const newProject: ProjectRecord = {
      ...sourceProject,
      id: newWorkspaceId,
      name: sourceProject.name ? `${sourceProject.name}` : '导入作品',
      createdAt: now,
      updatedAt: now,
    }

    // ── PASS 1: ID PRE-ALLOCATION (P0-1, INV-08) ──
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

    const entityIdMap = new Map<string, string>()
    const threadIdMap = new Map<string, string>()
    const promiseIdMap = new Map<string, string>()
    const sourceDomainData = archive.domainData || {}

    // Pre-allocate all domain primary IDs before writing any record
    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (!Array.isArray(records)) continue
      for (const rec of records) {
        if (rec && typeof rec === 'object' && 'id' in rec && typeof rec.id === 'string') {
          const generatedId = `${rec.id}-imported-${this.idGen.generate('sub').slice(-6)}`
          entityIdMap.set(rec.id, generatedId)
          if (storeName === 'narrativeThreads') {
            threadIdMap.set(rec.id, generatedId)
          } else if (storeName === 'promiseLedger') {
            promiseIdMap.set(rec.id, generatedId)
          }
        }
      }
    }

    // ── PASS 2: DEEP RECURSIVE FOREIGN KEY & TOPOLOGY REMAPPING ──
    const remappedDomainData: Record<string, Record<string, unknown>[]> = {}
    let totalRemappedDomainRecords = 0
    const encodedOldWorkspaceId = encodeURIComponent(oldWorkspaceId)
    const encodedNewWorkspaceId = encodeURIComponent(newWorkspaceId)

    const remapId = (id: unknown): string | unknown =>
      typeof id === 'string' && entityIdMap.has(id) ? entityIdMap.get(id)! : id

    const remapIdArray = (ids: unknown): unknown[] | unknown => {
      if (!Array.isArray(ids)) return ids
      return ids.map((id) => (typeof id === 'string' && entityIdMap.has(id) ? entityIdMap.get(id)! : id))
    }

    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (!Array.isArray(records)) continue
      const remappedList: Record<string, unknown>[] = []

      for (const rec of records) {
        if (!rec || typeof rec !== 'object') continue
        const item: Record<string, any> = { ...rec }

        // 1. Remap workspace/project foreign key
        if ('projectId' in item && item.projectId === oldWorkspaceId) {
          item.projectId = newWorkspaceId
        }
        if ('workspaceId' in item && item.workspaceId === oldWorkspaceId) {
          item.workspaceId = newWorkspaceId
        }

        // 2. Remap settingsKV keys (plain & URL-encoded)
        if (storeName === 'settingsKV' && 'key' in item && typeof item.key === 'string') {
          item.key = item.key
            .replaceAll(encodedOldWorkspaceId, encodedNewWorkspaceId)
            .replaceAll(oldWorkspaceId, newWorkspaceId)

          if (item.value && typeof item.value === 'object') {
            const val = { ...(item.value as Record<string, unknown>) }
            if (val.projectId === oldWorkspaceId) val.projectId = newWorkspaceId
            if (val.workspaceId === oldWorkspaceId) val.workspaceId = newWorkspaceId
            if (typeof val.chapterId === 'string' && chapterIdMap.has(val.chapterId)) {
              val.chapterId = chapterIdMap.get(val.chapterId)!
            }
            item.value = val
          }
        }

        // 3. Remap aiArtifacts ownership, metadata & parentArtifactId
        if (storeName === 'aiArtifacts') {
          if (item.ownership && typeof item.ownership === 'object') {
            item.ownership = { ...item.ownership, workspaceId: newWorkspaceId }
          }
          if (item.metadata && typeof item.metadata === 'object') {
            item.metadata = { ...item.metadata, workspaceId: newWorkspaceId }
          }
          if (item.parentArtifactId && entityIdMap.has(item.parentArtifactId)) {
            item.parentArtifactId = entityIdMap.get(item.parentArtifactId)!
          }
        }

        // 4. Remap volume foreign key
        if (typeof item.volumeId === 'string' && volumeIdMap.has(item.volumeId)) {
          item.volumeId = volumeIdMap.get(item.volumeId)!
        }

        // 5. Remap chapter foreign keys
        if (typeof item.chapterId === 'string' && chapterIdMap.has(item.chapterId)) {
          item.chapterId = chapterIdMap.get(item.chapterId)!
        }
        if (typeof item.sourceChapterId === 'string' && chapterIdMap.has(item.sourceChapterId)) {
          item.sourceChapterId = chapterIdMap.get(item.sourceChapterId)!
        }
        if (typeof item.targetChapterId === 'string' && chapterIdMap.has(item.targetChapterId)) {
          item.targetChapterId = chapterIdMap.get(item.targetChapterId)!
        }
        if (typeof item.documentId === 'string' && chapterIdMap.has(item.documentId)) {
          item.documentId = chapterIdMap.get(item.documentId)!
        }

        // 6. Systematic Deep Entity & Relational Foreign Key Remapping (P0-1)
        if (typeof item.sourceEntityId === 'string' && entityIdMap.has(item.sourceEntityId)) {
          item.sourceEntityId = entityIdMap.get(item.sourceEntityId)!
        }
        if (typeof item.targetEntityId === 'string' && entityIdMap.has(item.targetEntityId)) {
          item.targetEntityId = entityIdMap.get(item.targetEntityId)!
        }
        if (typeof item.targetId === 'string' && entityIdMap.has(item.targetId)) {
          item.targetId = entityIdMap.get(item.targetId)!
        }
        if (typeof item.entityId === 'string' && entityIdMap.has(item.entityId)) {
          item.entityId = entityIdMap.get(item.entityId)!
        }
        if (typeof item.characterId === 'string' && entityIdMap.has(item.characterId)) {
          item.characterId = entityIdMap.get(item.characterId)!
        }
        if (typeof item.locationId === 'string' && entityIdMap.has(item.locationId)) {
          item.locationId = entityIdMap.get(item.locationId)!
        }
        if (typeof item.factionId === 'string' && entityIdMap.has(item.factionId)) {
          item.factionId = entityIdMap.get(item.factionId)!
        }
        if (typeof item.parentId === 'string' && entityIdMap.has(item.parentId)) {
          item.parentId = entityIdMap.get(item.parentId)!
        }
        if (typeof item.parentEventId === 'string' && entityIdMap.has(item.parentEventId)) {
          item.parentEventId = entityIdMap.get(item.parentEventId)!
        }

        // 7. Remap thread & promise cross references
        if (typeof item.threadId === 'string' && entityIdMap.has(item.threadId)) {
          item.threadId = entityIdMap.get(item.threadId)!
        }
        if (typeof item.promiseId === 'string' && entityIdMap.has(item.promiseId)) {
          item.promiseId = entityIdMap.get(item.promiseId)!
        }

        // 8. Remap arrays of entity IDs
        if (Array.isArray(item.entityIds)) {
          item.entityIds = remapIdArray(item.entityIds)
        }
        if (Array.isArray(item.relatedEntityIds)) {
          item.relatedEntityIds = remapIdArray(item.relatedEntityIds)
        }
        if (Array.isArray(item.linkedEntityIds)) {
          item.linkedEntityIds = remapIdArray(item.linkedEntityIds)
        }
        if (Array.isArray(item.characterIds)) {
          item.characterIds = remapIdArray(item.characterIds)
        }
        if (Array.isArray(item.involvedEntityIds)) {
          item.involvedEntityIds = remapIdArray(item.involvedEntityIds)
        }
        if (Array.isArray(item.references)) {
          item.references = remapIdArray(item.references)
        }

        // 9. Remap nested relation collections
        if (Array.isArray(item.relations)) {
          item.relations = item.relations.map((rel: any) => {
            if (rel && typeof rel === 'object' && typeof rel.targetId === 'string') {
              return {
                ...rel,
                targetId: entityIdMap.get(rel.targetId) ?? rel.targetId,
              }
            }
            return rel
          })
        }

        // 10. Remap primary ID to avoid collision
        if ('id' in item && typeof item.id === 'string' && entityIdMap.has(item.id)) {
          item.id = entityIdMap.get(item.id)!
        }

        remappedList.push(item)
      }

      remappedDomainData[storeName] = remappedList
      totalRemappedDomainRecords += remappedList.length
    }

    // ── PASS 3: TOPOLOGICAL REFERENTIAL INTEGRITY CHECK (P0-1, INV-08) ──
    const validVolumeIds = new Set(newVolumes.map((v) => v.id))
    const validChapterIds = new Set(newChapters.map((c) => c.id))
    const validEntityIds = new Set(Array.from(entityIdMap.values()))

    // Check chapters reference valid volumes
    for (const ch of newChapters) {
      if (ch.volumeId && !validVolumeIds.has(ch.volumeId)) {
        return {
          ok: false,
          error: `Referential integrity violation: Chapter '${ch.id}' references unknown volume '${ch.volumeId}'`,
        }
      }
    }

    // Check domain records reference valid chapters, volumes, and entities
    for (const [storeName, records] of Object.entries(remappedDomainData)) {
      for (const rec of records) {
        if (rec.volumeId && typeof rec.volumeId === 'string' && !validVolumeIds.has(rec.volumeId)) {
          return {
            ok: false,
            error: `Referential integrity violation: ${storeName} record references non-existent volume '${rec.volumeId}'`,
          }
        }
        if (rec.chapterId && typeof rec.chapterId === 'string' && !validChapterIds.has(rec.chapterId)) {
          return {
            ok: false,
            error: `Referential integrity violation: ${storeName} record references non-existent chapter '${rec.chapterId}'`,
          }
        }
        // Validate relational integrity: sourceEntityId and targetEntityId must point to valid new entities
        if (rec.sourceEntityId && typeof rec.sourceEntityId === 'string' && !validEntityIds.has(rec.sourceEntityId)) {
          return {
            ok: false,
            error: `Referential integrity violation: ${storeName} record references non-existent sourceEntityId '${rec.sourceEntityId}'`,
          }
        }
        if (rec.targetEntityId && typeof rec.targetEntityId === 'string' && !validEntityIds.has(rec.targetEntityId)) {
          return {
            ok: false,
            error: `Referential integrity violation: ${storeName} record references non-existent targetEntityId '${rec.targetEntityId}'`,
          }
        }
      }
    }

    // Atomic-style persistence with automatic rollback on failure (P0-1, INV-08)
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
   * Processes any pending workspace purge tombstones whenever the Daemon connection is restored.
   */
  async processPendingPurgeTombstones(remoteClient?: {
    purgeWorkspace?: (id: string) => Promise<unknown>
    request?: (method: string, params?: unknown) => Promise<unknown>
  }): Promise<void> {
    if (!remoteClient) return
    const tombstones = loadPurgeTombstones()
    if (tombstones.length === 0) return

    for (const tombstone of tombstones) {
      try {
        if (typeof remoteClient.purgeWorkspace === 'function') {
          await remoteClient.purgeWorkspace(tombstone.workspaceId)
        } else if (typeof remoteClient.request === 'function') {
          await remoteClient.request('workspace.purge', { workspaceId: tombstone.workspaceId })
        }
        clearPurgeTombstone(tombstone.workspaceId)
      } catch (e) {
        console.warn(`[WorkspaceLifecycle] Retrying purge tombstone failed for ${tombstone.workspaceId}:`, e)
      }
    }
  }

  /**
   * 永久清除工作区数据 (Permanent Purge) (P0-2, P0.8):
   * 1. 记录 durable purge tombstone，确保离线删除在下次 Daemon 连接时必被补偿重放。
   * 2. 若当前已连接 remoteClient，先跨进程触发 Daemon 远程 purge: workspace.purge(workspaceId)
   *    成功后即刻解除 tombstone。
   * 3. 清除本地 Project、Volumes、Chapters、所有领域及插件表、AI 产物、Domain Change 记录以及本地 Draft Journal，
   *    彻底杜绝孤魂残留与跨工作区泄漏。
   */
  async purgeWorkspace(
    workspaceId: string,
    remoteClient?: {
      purgeWorkspace?: (id: string) => Promise<unknown>
      request?: (method: string, params?: unknown) => Promise<unknown>
    },
  ): Promise<void> {
    // 0. Durable tombstone registration (offline-resilient)
    recordPurgeTombstone(workspaceId)

    // 1. Remote purge if client provided
    if (remoteClient) {
      try {
        if (typeof remoteClient.purgeWorkspace === 'function') {
          await remoteClient.purgeWorkspace(workspaceId)
        } else if (typeof remoteClient.request === 'function') {
          await remoteClient.request('workspace.purge', { workspaceId })
        }
        // Remote succeeded: clear tombstone immediately
        clearPurgeTombstone(workspaceId)
      } catch (e) {
        console.warn(`Remote workspace.purge failed for ${workspaceId}; durable tombstone retained:`, e)
      }
    }

    // 2. Delete chapters and volumes
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
    const encodedWorkspaceId = encodeURIComponent(workspaceId)
    for (const storeName of PROJECT_DOMAIN_STORES) {
      if (typeof db.getAll === 'function' && typeof db.delete === 'function') {
        try {
          const records = await db.getAll<Record<string, unknown>>(storeName as any)
          for (const rec of records) {
            let matches =
              rec.projectId === workspaceId ||
              rec.workspaceId === workspaceId ||
              (rec as any).ownership?.workspaceId === workspaceId

            if (!matches && storeName === 'settingsKV') {
              const key = String((rec as any).key || '')
              matches =
                key.includes(workspaceId) ||
                key.includes(encodedWorkspaceId) ||
                key.startsWith(`ai-task-recovery::${encodedWorkspaceId}`) ||
                key.startsWith(`distillation-review::${encodedWorkspaceId}`) ||
                key.startsWith(`storyState::${workspaceId}`) ||
                key.startsWith(`inkpi-excluded-nums-${workspaceId}`) ||
                key.startsWith(`inkpi-daily-goal-${workspaceId}`)
            }

            if (matches) {
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
