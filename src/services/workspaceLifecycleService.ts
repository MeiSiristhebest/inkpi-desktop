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
  type WorkspaceLocalStorageEntry,
} from './workspaceManifest'

export interface ImportWorkspaceOptions {
  mode?: 'copy' | 'restore'
}

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

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined

const isRecord = (value: unknown): value is UnknownRecord => asRecord(value) !== undefined

const WORKSPACE_LOCAL_STORAGE_EXCLUDED_KEYS = new Set([
  'inkpi-settings',
  'inkpi-device-id',
  'inkpi-purge-tombstones',
  'inkpi_enabled_plugins_v2',
  'inkpi-ai-catalog-meta',
])
const SECRET_LOCAL_STORAGE_KEY = /api[-_]?key|secret|token|password|credential/i

function collectWorkspaceLocalStorage(
  workspaceId: string,
  chapterIds: readonly string[],
): WorkspaceLocalStorageEntry[] {
  if (typeof localStorage === 'undefined') return []
  const encodedWorkspaceId = encodeURIComponent(workspaceId)
  const entries: WorkspaceLocalStorageEntry[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || !isWorkspaceLocalStorageKey(key, workspaceId, encodedWorkspaceId, chapterIds)) {
        continue
      }
      const value = localStorage.getItem(key)
      if (value !== null) entries.push({ key, value })
    }
  } catch {
    // A blocked/private localStorage must not make a durable IndexedDB backup fail.
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key))
}

function isWorkspaceLocalStorageKey(
  key: string,
  workspaceId: string,
  encodedWorkspaceId: string,
  chapterIds: readonly string[],
): boolean {
  if (WORKSPACE_LOCAL_STORAGE_EXCLUDED_KEYS.has(key) || SECRET_LOCAL_STORAGE_KEY.test(key)) {
    return false
  }
  if (
    key.startsWith(`inkpi_draft_journal:${workspaceId}:`) ||
    key.startsWith(`inkpi_enabled_plugins_${workspaceId}`) ||
    key.startsWith(`inkpi-scratchpad-${workspaceId}-`) ||
    key === `inkpi-excluded-nums-${workspaceId}` ||
    key === `inkpi-daily-goal-${workspaceId}` ||
    key.includes(workspaceId) ||
    key.includes(encodedWorkspaceId)
  ) {
    return true
  }
  return chapterIds.some((chapterId) => key === `chapter-history-${chapterId}`)
}

function remapWorkspaceLocalStorage(
  entries: readonly WorkspaceLocalStorageEntry[],
  oldWorkspaceId: string,
  newWorkspaceId: string,
  chapterIdMap: ReadonlyMap<string, string>,
): WorkspaceLocalStorageEntry[] {
  const encodedOldWorkspaceId = encodeURIComponent(oldWorkspaceId)
  const encodedNewWorkspaceId = encodeURIComponent(newWorkspaceId)
  return entries.flatMap((entry) => {
    if (!entry || typeof entry.key !== 'string' || typeof entry.value !== 'string') return []
    let key = entry.key
    if (key.startsWith('chapter-history-')) {
      const oldChapterId = key.slice('chapter-history-'.length)
      key = `chapter-history-${chapterIdMap.get(oldChapterId) ?? oldChapterId}`
    } else {
      key = key
        .replaceAll(encodedOldWorkspaceId, encodedNewWorkspaceId)
        .replaceAll(oldWorkspaceId, newWorkspaceId)
      const draftPrefix = `inkpi_draft_journal:${newWorkspaceId}:`
      if (key.startsWith(draftPrefix)) {
        const oldChapterId = key.slice(draftPrefix.length)
        key = `${draftPrefix}${chapterIdMap.get(oldChapterId) ?? oldChapterId}`
      }
    }

    let value = entry.value
    const draftObject = parseJsonRecord(value)
    if (key.startsWith(`inkpi_draft_journal:${newWorkspaceId}:`) && draftObject) {
      draftObject.workspaceId = newWorkspaceId
      if (typeof draftObject.chapterId === 'string') {
        draftObject.chapterId = chapterIdMap.get(draftObject.chapterId) ?? draftObject.chapterId
      }
      value = JSON.stringify(draftObject)
    } else if (key === `inkpi-excluded-nums-${newWorkspaceId}`) {
      const excludedIds = parseJsonArray(value)
      if (excludedIds) {
        value = JSON.stringify(
          excludedIds.map((item) =>
            typeof item === 'string' ? (chapterIdMap.get(item) ?? item) : item,
          ),
        )
      }
    }
    return [{ key, value }]
  })
}

function parseJsonRecord(value: string): UnknownRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? { ...parsed } : undefined
  } catch {
    return undefined
  }
}

function parseJsonArray(value: string): unknown[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function applyWorkspaceLocalStorage(entries: readonly WorkspaceLocalStorageEntry[]): () => void {
  if (typeof localStorage === 'undefined' || entries.length === 0) return () => undefined
  const previous = new Map<string, string | null>()
  try {
    for (const entry of entries) {
      previous.set(entry.key, localStorage.getItem(entry.key))
      localStorage.setItem(entry.key, entry.value)
    }
  } catch (error) {
    restoreWorkspaceLocalStorage(previous)
    throw error
  }
  return () => restoreWorkspaceLocalStorage(previous)
}

function restoreWorkspaceLocalStorage(previous: ReadonlyMap<string, string | null>): void {
  if (typeof localStorage === 'undefined') return
  for (const [key, value] of previous) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch (error) {
      console.warn(`[WorkspaceLifecycle] Failed to restore localStorage key ${key}`, error)
    }
  }
}

function purgeWorkspaceLocalStorage(workspaceId: string, chapterIds: readonly string[]): void {
  if (typeof localStorage === 'undefined') return
  const keys = collectWorkspaceLocalStorage(workspaceId, chapterIds).map((entry) => entry.key)
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`[WorkspaceLifecycle] Failed to purge localStorage key ${key}`, error)
    }
  }
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

export type IdNamespace =
  'volume' | 'chapter' | 'entity' | 'timelineNode' | 'thread' | 'promise' | 'artifact'

export interface WorkspaceReferenceDescriptor {
  storeName: string
  idNamespace?: IdNamespace
  references: Array<{
    targetNamespace: IdNamespace
    path: string
    kind: 'scalar' | 'array' | 'objectArray'
    objectProperty?: string
  }>
}

export const WORKSPACE_STORE_DESCRIPTORS: WorkspaceReferenceDescriptor[] = [
  {
    storeName: 'narrativeThreads',
    idNamespace: 'thread',
    references: [],
  },
  {
    storeName: 'timelineNodes',
    idNamespace: 'timelineNode',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'thread', path: 'threadId', kind: 'scalar' },
      { targetNamespace: 'timelineNode', path: 'parentEventId', kind: 'scalar' },
      { targetNamespace: 'timelineNode', path: 'prerequisites', kind: 'array' },
      { targetNamespace: 'timelineNode', path: 'nextEventIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'entityIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'characterIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'locationId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'promiseLedger',
    idNamespace: 'promise',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'chapter', path: 'relatedChapterIds', kind: 'array' },
      { targetNamespace: 'thread', path: 'threadId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'relatedEntityIds', kind: 'array' },
    ],
  },
  {
    storeName: 'aiArtifacts',
    idNamespace: 'artifact',
    references: [
      { targetNamespace: 'chapter', path: 'documentId', kind: 'scalar' },
      { targetNamespace: 'artifact', path: 'metadata.parentArtifactId', kind: 'scalar' },
      { targetNamespace: 'artifact', path: 'lineage.parentArtifactId', kind: 'scalar' },
      { targetNamespace: 'artifact', path: 'provenance.parentArtifactId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'codexEntities',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'entity', path: 'parentId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'relatedEntityIds', kind: 'array' },
      {
        targetNamespace: 'entity',
        path: 'relations',
        kind: 'objectArray',
        objectProperty: 'targetId',
      },
    ],
  },
  {
    storeName: 'geoMapGrids',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'entity', path: 'locationId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'parentLocationId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'linkedOverlays.activeCharacterIds', kind: 'array' },
      { targetNamespace: 'promise', path: 'linkedOverlays.foreshadowIds', kind: 'array' },
      { targetNamespace: 'timelineNode', path: 'linkedOverlays.timelineEventIds', kind: 'array' },
    ],
  },
  {
    storeName: 'sceneBeats',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'volume', path: 'volumeId', kind: 'scalar' },
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'characterIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'locationId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'clueMatrices',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'sourceEntityId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'targetEntityId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'targetId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'entityIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'relatedEntityIds', kind: 'array' },
    ],
  },
  {
    storeName: 'readerHooks',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'relatedEntityIds', kind: 'array' },
    ],
  },
  {
    storeName: 'combatDuels',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'characterIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'locationId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'factionDiplomacies',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'entity', path: 'sourceEntityId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'targetEntityId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'factionId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'diffReviews',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'chapter', path: 'sourceChapterId', kind: 'scalar' },
      { targetNamespace: 'chapter', path: 'targetChapterId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'dialogueVoiceprints',
    idNamespace: 'entity',
    references: [{ targetNamespace: 'entity', path: 'characterId', kind: 'scalar' }],
  },
  {
    storeName: 'voiceScriptCasts',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'entity', path: 'characterId', kind: 'scalar' },
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'storyboardScenes',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'chapter', path: 'chapterId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'characterIds', kind: 'array' },
      { targetNamespace: 'entity', path: 'locationId', kind: 'scalar' },
    ],
  },
  {
    storeName: 'subPlotStrands',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'thread', path: 'threadId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'entityIds', kind: 'array' },
    ],
  },
  {
    storeName: 'characterRelations',
    idNamespace: 'entity',
    references: [
      { targetNamespace: 'entity', path: 'sourceEntityId', kind: 'scalar' },
      { targetNamespace: 'entity', path: 'targetEntityId', kind: 'scalar' },
    ],
  },
]

const PURGE_TOMBSTONES_KEY = 'inkpi-purge-tombstones'

export interface PurgeTombstone {
  workspaceId: string
  purgedAt: number
}

function loadPurgeTombstones(): PurgeTombstone[] {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(PURGE_TOMBSTONES_KEY) : null
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

  try {
    if (typeof db.put === 'function') {
      db.put('settingsKV', {
        key: PURGE_TOMBSTONES_KEY,
        value: tombstones,
        updatedAt: Date.now(),
      }).catch(() => {})
    }
  } catch {
    // ignore IndexedDB persistence errors
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
    const localStorageData = collectWorkspaceLocalStorage(
      workspaceId,
      chapters.map((chapter) => chapter.id),
    )

    const domainData: Record<string, Record<string, unknown>[]> = {}
    let totalRecordsCount = 1 + volumes.length + chapters.length + localStorageData.length
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
      localStorageKeysIncluded: localStorageData.map((entry) => entry.key),
      totalRecordsCount,
    }

    return {
      manifest,
      project,
      volumes,
      chapters,
      domainData,
      localStorageData,
    }
  }

  /**
   * 导入工作区并执行完整的 3-Pass Object Graph Remapping (P0-1, INV-03, INV-04, INV-08):
   * Pass 1: 分配全新的 workspaceId、volumeId、chapterId 以及各类 domain entity ID 映射。
   * Pass 2: 递归重映射所有的 foreign keys (projectId, volumeId, chapterId, lineage, settingsKV 编码 key 等)，杜绝全局 ID 碰撞与跨项目污染。
   * Pass 3: 严格引用完整性校验 (Referential Integrity Check)，若发现任何孤立或断裂的外键，立即抛出异常触发自动回滚。
   */
  async importWorkspace(
    archiveRaw: unknown,
    options: ImportWorkspaceOptions = {},
  ): Promise<ImportWorkspaceResult> {
    return this.importWorkspaceAsCopy(archiveRaw, options)
  }

  /**
   * 复制克隆模式导入（默认）：
   * 剥离旧工作区的 domainChangeSets 与活动中 aiProposals，避免跨工作区序号/哈希冲突；重分配全新拓扑图。
   */
  async importWorkspaceAsCopy(
    archiveRaw: unknown,
    options: ImportWorkspaceOptions = {},
  ): Promise<ImportWorkspaceResult> {
    return this.internalImportWorkspace(archiveRaw, { ...options, mode: 'copy' })
  }

  /**
   * 备份恢复模式导入：
   * 尽可能忠实还原工作区归档，保留历史变更集；如果目标是全新工作区同样重新命名空间化。
   */
  async restoreWorkspaceBackup(
    archiveRaw: unknown,
    options: ImportWorkspaceOptions = {},
  ): Promise<ImportWorkspaceResult> {
    return this.internalImportWorkspace(archiveRaw, { ...options, mode: 'restore' })
  }

  private async internalImportWorkspace(
    archiveRaw: unknown,
    options: ImportWorkspaceOptions = {},
  ): Promise<ImportWorkspaceResult> {
    const mode = options.mode ?? 'copy'
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

    // ── PASS 1: NAMESPACED ID PRE-ALLOCATION (P0-1, INV-08) ──
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
    const remappedLocalStorageData = remapWorkspaceLocalStorage(
      Array.isArray(archive.localStorageData) ? archive.localStorageData : [],
      oldWorkspaceId,
      newWorkspaceId,
      chapterIdMap,
    )

    // Strict namespaced ID maps to prevent cross-store key collisions
    const entityIdMap = new Map<string, string>()
    const threadIdMap = new Map<string, string>()
    const promiseIdMap = new Map<string, string>()
    const artifactIdMap = new Map<string, string>()
    const timelineNodeIdMap = new Map<string, string>()
    const rawDomainData = archive.domainData || {}

    // In 'copy' mode, strip domainChangeSets and aiProposals to avoid sequence/checksum collisions
    const sourceDomainData: Record<string, Record<string, unknown>[]> = {}
    for (const [store, records] of Object.entries(rawDomainData)) {
      if (!Array.isArray(records)) continue
      if (mode === 'copy' && (store === 'domainChangeSets' || store === 'aiProposals')) {
        continue
      }
      sourceDomainData[store] = records
    }

    // Pre-allocate deterministic namespaced primary IDs using WORKSPACE_STORE_DESCRIPTORS
    const descriptorMap = new Map<string, WorkspaceReferenceDescriptor>(
      WORKSPACE_STORE_DESCRIPTORS.map((d) => [d.storeName, d]),
    )

    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (!Array.isArray(records)) continue
      const desc = descriptorMap.get(storeName)
      const ns: IdNamespace = desc?.idNamespace ?? 'entity'

      for (const rec of records) {
        if (rec && typeof rec === 'object' && 'id' in rec && typeof rec.id === 'string') {
          const generatedId = `${rec.id}-imported-${this.idGen.generate('sub').slice(-6)}`
          if (ns === 'thread') {
            threadIdMap.set(rec.id, generatedId)
          } else if (ns === 'promise') {
            promiseIdMap.set(rec.id, generatedId)
          } else if (ns === 'artifact') {
            artifactIdMap.set(rec.id, generatedId)
          } else if (ns === 'timelineNode') {
            timelineNodeIdMap.set(rec.id, generatedId)
          } else {
            entityIdMap.set(rec.id, generatedId)
          }
        }
      }
    }

    // Pre-allocate IDs for any StoryState items inside settingsKV if not already registered
    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (storeName === 'settingsKV' && Array.isArray(records)) {
        for (const rec of records) {
          if (
            rec &&
            typeof rec === 'object' &&
            typeof (rec as any).key === 'string' &&
            (rec as any).key.startsWith('storyState::')
          ) {
            const val = (rec as any).value
            if (val && typeof val === 'object') {
              if (val.events && typeof val.events === 'object') {
                for (const oldEvtId of Object.keys(val.events)) {
                  if (!timelineNodeIdMap.has(oldEvtId)) {
                    timelineNodeIdMap.set(
                      oldEvtId,
                      `${oldEvtId}-imported-${this.idGen.generate('sub').slice(-6)}`,
                    )
                  }
                }
              }
              if (val.timelines && typeof val.timelines === 'object') {
                for (const oldTlId of Object.keys(val.timelines)) {
                  if (!threadIdMap.has(oldTlId)) {
                    threadIdMap.set(
                      oldTlId,
                      `${oldTlId}-imported-${this.idGen.generate('sub').slice(-6)}`,
                    )
                  }
                }
              }
              if (val.promises && typeof val.promises === 'object') {
                for (const oldPromId of Object.keys(val.promises)) {
                  if (!promiseIdMap.has(oldPromId)) {
                    promiseIdMap.set(
                      oldPromId,
                      `${oldPromId}-imported-${this.idGen.generate('sub').slice(-6)}`,
                    )
                  }
                }
              }
            }
          }
        }
      }
    }

    // ── PASS 2: SCHEMA-DRIVEN DEEP RECURSIVE TOPOLOGY REMAPPING ──
    const remappedDomainData: Record<string, Record<string, unknown>[]> = {}
    let totalRemappedDomainRecords = 0
    const encodedOldWorkspaceId = encodeURIComponent(oldWorkspaceId)
    const encodedNewWorkspaceId = encodeURIComponent(newWorkspaceId)
    const remapCompositeProjectKey = (key: string): string =>
      key.startsWith(`${oldWorkspaceId}::`)
        ? `${newWorkspaceId}${key.slice(oldWorkspaceId.length)}`
        : key

    const getNamespaceMap = (ns: IdNamespace): Map<string, string> => {
      switch (ns) {
        case 'volume':
          return volumeIdMap
        case 'chapter':
          return chapterIdMap
        case 'entity':
          return entityIdMap
        case 'timelineNode':
          return timelineNodeIdMap
        case 'thread':
          return threadIdMap
        case 'promise':
          return promiseIdMap
        case 'artifact':
          return artifactIdMap
      }
    }

    const remapByNamespace = (value: string, ns: IdNamespace): string => {
      const map = getNamespaceMap(ns)
      return map.get(value) ?? value
    }

    const remapArrayByNamespace = (values: readonly unknown[], ns: IdNamespace): unknown[] => {
      const map = getNamespaceMap(ns)
      return values.map((value) =>
        typeof value === 'string' && map.has(value) ? map.get(value)! : value,
      )
    }

    const remapDottedPath = (
      obj: Record<string, unknown>,
      path: string,
      kind: 'scalar' | 'array' | 'objectArray',
      ns: IdNamespace,
      objectProp?: string,
    ): void => {
      const parts = path.split('.')
      let current: Record<string, unknown> | undefined = obj
      for (let i = 0; i < parts.length - 1; i++) {
        const next: unknown = current?.[parts[i]]
        if (!isRecord(next)) return
        current = next
      }
      if (!current) return
      const lastKey = parts[parts.length - 1]

      if (kind === 'scalar') {
        if (typeof current[lastKey] === 'string') {
          current[lastKey] = remapByNamespace(current[lastKey] as string, ns)
        }
      } else if (kind === 'array') {
        if (Array.isArray(current[lastKey])) {
          current[lastKey] = remapArrayByNamespace(current[lastKey] as unknown[], ns)
        }
      } else if (kind === 'objectArray' && objectProp) {
        if (Array.isArray(current[lastKey])) {
          current[lastKey] = (current[lastKey] as unknown[]).map((element) => {
            const record = asRecord(element)
            if (record && typeof record[objectProp] === 'string') {
              return {
                ...record,
                [objectProp]: remapByNamespace(record[objectProp] as string, ns),
              }
            }
            return element
          })
        }
      }
    }

    for (const [storeName, records] of Object.entries(sourceDomainData)) {
      if (!Array.isArray(records)) continue
      const desc = descriptorMap.get(storeName)
      const primaryNs: IdNamespace = desc?.idNamespace ?? 'entity'
      const primaryMap = getNamespaceMap(primaryNs)
      const remappedList: Record<string, unknown>[] = []

      for (const rec of records) {
        if (!rec || typeof rec !== 'object') continue
        const item: Record<string, unknown> = { ...rec }

        // 1. Workspace / Project Foreign Keys
        if ('projectId' in item && item.projectId === oldWorkspaceId) {
          item.projectId = newWorkspaceId
        }
        if ('workspaceId' in item && item.workspaceId === oldWorkspaceId) {
          item.workspaceId = newWorkspaceId
        }

        // Composite primary keys encode the old workspace ID and must be
        // remapped together with the record's projectId.
        if (storeName === 'dailyStats' || storeName === 'formData') {
          if (typeof item.key === 'string') item.key = remapCompositeProjectKey(item.key)
          if (typeof item.id === 'string') item.id = remapCompositeProjectKey(item.id)
        }

        // 2. SettingsKV & Nested StoryState Object Graph Remapping
        if (storeName === 'settingsKV' && 'key' in item && typeof item.key === 'string') {
          item.key = item.key
            .replaceAll(encodedOldWorkspaceId, encodedNewWorkspaceId)
            .replaceAll(oldWorkspaceId, newWorkspaceId)

          if (item.value && typeof item.value === 'object') {
            const val = { ...(item.value as Record<string, unknown>) }
            const settingsKey = typeof item.key === 'string' ? item.key : ''
            if (val.projectId === oldWorkspaceId) val.projectId = newWorkspaceId
            if (val.workspaceId === oldWorkspaceId) val.workspaceId = newWorkspaceId
            if (typeof val.chapterId === 'string' && chapterIdMap.has(val.chapterId)) {
              val.chapterId = chapterIdMap.get(val.chapterId)!
            }

            // Recursive StoryState Nested Graph Remapping (P0-1)
            if (settingsKey.startsWith('storyState::') || val.entities || val.relations) {
              // Remap entities dictionary
              if (val.entities && typeof val.entities === 'object') {
                const remappedEntities: Record<string, unknown> = {}
                for (const [oldEntId, entData] of Object.entries(val.entities)) {
                  const newEntId = entityIdMap.get(oldEntId) ?? oldEntId
                  remappedEntities[newEntId] = {
                    ...(entData as any),
                    id: newEntId,
                  }
                }
                val.entities = remappedEntities
              }

              // Remap relations dictionary
              if (val.relations && typeof val.relations === 'object') {
                const remappedRelations: Record<string, unknown> = {}
                for (const [oldRelId, relData] of Object.entries(val.relations)) {
                  const rel = asRecord(relData)
                  if (!rel) {
                    remappedRelations[oldRelId] = relData
                    continue
                  }
                  if (
                    typeof rel.sourceEntityId === 'string' &&
                    entityIdMap.has(rel.sourceEntityId)
                  ) {
                    rel.sourceEntityId = entityIdMap.get(rel.sourceEntityId)!
                  }
                  if (
                    typeof rel.targetEntityId === 'string' &&
                    entityIdMap.has(rel.targetEntityId)
                  ) {
                    rel.targetEntityId = entityIdMap.get(rel.targetEntityId)!
                  }
                  remappedRelations[oldRelId] = rel
                }
                val.relations = remappedRelations
              }

              // Remap events dictionary (keys and IDs remapped to timelineNode namespace)
              if (val.events && typeof val.events === 'object') {
                const remappedEvents: Record<string, unknown> = {}
                for (const [oldEvtId, evtData] of Object.entries(val.events)) {
                  const evt = { ...(evtData as any) }
                  const newEvtId = timelineNodeIdMap.get(oldEvtId) ?? oldEvtId
                  evt.id = newEvtId
                  if (Array.isArray(evt.entityIds)) {
                    evt.entityIds = remapArrayByNamespace(evt.entityIds, 'entity')
                  }
                  remappedEvents[newEvtId] = evt
                }
                val.events = remappedEvents
              }

              // Remap timelines dictionary (keys and IDs remapped to thread namespace)
              if (val.timelines && typeof val.timelines === 'object') {
                const remappedTimelines: Record<string, unknown> = {}
                for (const [oldTlId, tlData] of Object.entries(val.timelines)) {
                  const tl = { ...(tlData as any) }
                  const newTlId = threadIdMap.get(oldTlId) ?? oldTlId
                  tl.id = newTlId
                  if (Array.isArray(tl.eventIds)) {
                    tl.eventIds = remapArrayByNamespace(tl.eventIds, 'timelineNode')
                  }
                  if (Array.isArray(tl.constraints)) {
                    tl.constraints = tl.constraints.map((c: any) => ({
                      ...c,
                      eventIds: Array.isArray(c?.eventIds)
                        ? remapArrayByNamespace(c.eventIds, 'timelineNode')
                        : c?.eventIds,
                    }))
                  }
                  remappedTimelines[newTlId] = tl
                }
                val.timelines = remappedTimelines
              }

              // Remap promises dictionary (keys and IDs remapped to promise namespace)
              if (val.promises && typeof val.promises === 'object') {
                const remappedPromises: Record<string, unknown> = {}
                for (const [oldPromId, promData] of Object.entries(val.promises)) {
                  const prom = { ...(promData as any) }
                  const newPromId = promiseIdMap.get(oldPromId) ?? oldPromId
                  prom.id = newPromId
                  if (prom.threadId && threadIdMap.has(prom.threadId)) {
                    prom.threadId = threadIdMap.get(prom.threadId)!
                  }
                  remappedPromises[newPromId] = prom
                }
                val.promises = remappedPromises
              }
            }

            item.value = val
          }
        }

        // 3. AiArtifacts Deep Lineage, Provenance & Ownership Remapping
        if (storeName === 'aiArtifacts') {
          if (item.ownership && typeof item.ownership === 'object') {
            item.ownership = { ...item.ownership, workspaceId: newWorkspaceId }
          }
          if (item.metadata && typeof item.metadata === 'object') {
            item.metadata = { ...item.metadata, workspaceId: newWorkspaceId }
          }
        }

        // 4. Declarative Schema-Driven Reference Remapping
        if (desc) {
          for (const ref of desc.references) {
            remapDottedPath(item, ref.path, ref.kind, ref.targetNamespace, ref.objectProperty)
          }
        } else {
          // Fallback heuristic for ad-hoc stores not yet in descriptors
          if (typeof item.volumeId === 'string' && volumeIdMap.has(item.volumeId)) {
            item.volumeId = volumeIdMap.get(item.volumeId)!
          }
          if (typeof item.chapterId === 'string' && chapterIdMap.has(item.chapterId)) {
            item.chapterId = chapterIdMap.get(item.chapterId)!
          }
          if (typeof item.locationId === 'string' && entityIdMap.has(item.locationId)) {
            item.locationId = entityIdMap.get(item.locationId)!
          }
          if (typeof item.entityId === 'string' && entityIdMap.has(item.entityId)) {
            item.entityId = entityIdMap.get(item.entityId)!
          }
          if (typeof item.sourceEntityId === 'string' && entityIdMap.has(item.sourceEntityId)) {
            item.sourceEntityId = entityIdMap.get(item.sourceEntityId)!
          }
          if (typeof item.targetEntityId === 'string' && entityIdMap.has(item.targetEntityId)) {
            item.targetEntityId = entityIdMap.get(item.targetEntityId)!
          }
        }

        // 5. Primary ID Mapping
        if ('id' in item && typeof item.id === 'string' && primaryMap.has(item.id)) {
          item.id = primaryMap.get(item.id)!
        }

        remappedList.push(item)
      }

      remappedDomainData[storeName] = remappedList
      totalRemappedDomainRecords += remappedList.length
    }

    // ── PASS 3: STRICT TOPOLOGICAL GRAPH INTEGRITY VALIDATION (P0-1, INV-08) ──
    const validVolumeIds = new Set(newVolumes.map((v) => v.id))
    const validChapterIds = new Set(newChapters.map((c) => c.id))
    const validEntityIds = new Set(Array.from(entityIdMap.values()))
    const validArtifactIds = new Set(Array.from(artifactIdMap.values()))
    const validTimelineNodeIds = new Set(Array.from(timelineNodeIdMap.values()))
    const validThreadIds = new Set(Array.from(threadIdMap.values()))
    const validPromiseIds = new Set(Array.from(promiseIdMap.values()))

    const getValidSetForNamespace = (ns: IdNamespace): Set<string> => {
      switch (ns) {
        case 'volume':
          return validVolumeIds
        case 'chapter':
          return validChapterIds
        case 'entity':
          return validEntityIds
        case 'timelineNode':
          return validTimelineNodeIds
        case 'thread':
          return validThreadIds
        case 'promise':
          return validPromiseIds
        case 'artifact':
          return validArtifactIds
      }
    }

    // 1. Validate chapters reference valid volumes
    for (const ch of newChapters) {
      if (ch.volumeId && !validVolumeIds.has(ch.volumeId)) {
        return {
          ok: false,
          error: `Referential integrity violation: Chapter '${ch.id}' references unknown volume '${ch.volumeId}'`,
        }
      }
    }

    // Helper to extract values by dotted path
    const extractPathValues = (obj: any, path: string): unknown[] => {
      const parts = path.split('.')
      let current: any[] = [obj]
      for (const part of parts) {
        const next: any[] = []
        for (const item of current) {
          if (item && typeof item === 'object' && part in item) {
            next.push(item[part])
          }
        }
        current = next
      }
      return current
    }

    // 2. Validate domain records against declarative descriptors
    for (const [storeName, records] of Object.entries(remappedDomainData)) {
      const desc = descriptorMap.get(storeName)

      for (const rec of records) {
        if (desc) {
          for (const ref of desc.references) {
            const validSet = getValidSetForNamespace(ref.targetNamespace)
            const extracted = extractPathValues(rec, ref.path)

            for (const val of extracted) {
              if (ref.kind === 'scalar') {
                if (typeof val === 'string' && val.length > 0 && !validSet.has(val)) {
                  return {
                    ok: false,
                    error: `Referential integrity violation: ${storeName} record references non-existent ${ref.targetNamespace} '${val}' at '${ref.path}'`,
                  }
                }
              } else if (ref.kind === 'array') {
                if (Array.isArray(val)) {
                  for (const elem of val) {
                    if (typeof elem === 'string' && elem.length > 0 && !validSet.has(elem)) {
                      return {
                        ok: false,
                        error: `Referential integrity violation: ${storeName} record references non-existent ${ref.targetNamespace} '${elem}' at '${ref.path}'`,
                      }
                    }
                  }
                }
              } else if (ref.kind === 'objectArray' && ref.objectProperty) {
                if (Array.isArray(val)) {
                  for (const elem of val) {
                    if (
                      elem &&
                      typeof elem === 'object' &&
                      typeof elem[ref.objectProperty] === 'string'
                    ) {
                      const targetVal = elem[ref.objectProperty]
                      if (targetVal && !validSet.has(targetVal)) {
                        return {
                          ok: false,
                          error: `Referential integrity violation: ${storeName} entity contains nested relation pointing to non-existent ${ref.targetNamespace} '${targetVal}'`,
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          // Fallback checks for unconfigured stores
          if (
            rec.volumeId &&
            typeof rec.volumeId === 'string' &&
            !validVolumeIds.has(rec.volumeId)
          ) {
            return {
              ok: false,
              error: `Referential integrity violation: ${storeName} record references non-existent volume '${rec.volumeId}'`,
            }
          }
          if (
            rec.chapterId &&
            typeof rec.chapterId === 'string' &&
            !validChapterIds.has(rec.chapterId)
          ) {
            return {
              ok: false,
              error: `Referential integrity violation: ${storeName} record references non-existent chapter '${rec.chapterId}'`,
            }
          }
          if (
            rec.sourceEntityId &&
            typeof rec.sourceEntityId === 'string' &&
            !validEntityIds.has(rec.sourceEntityId)
          ) {
            return {
              ok: false,
              error: `Referential integrity violation: ${storeName} record references non-existent sourceEntityId '${rec.sourceEntityId}'`,
            }
          }
          if (
            rec.targetEntityId &&
            typeof rec.targetEntityId === 'string' &&
            !validEntityIds.has(rec.targetEntityId)
          ) {
            return {
              ok: false,
              error: `Referential integrity violation: ${storeName} record references non-existent targetEntityId '${rec.targetEntityId}'`,
            }
          }
        }

        // Validate nested StoryState relations inside settingsKV
        if (
          storeName === 'settingsKV' &&
          rec.key &&
          typeof rec.key === 'string' &&
          rec.key.startsWith('storyState::') &&
          rec.value &&
          isRecord(rec.value) &&
          isRecord(rec.value.relations)
        ) {
          for (const [relId, relValue] of Object.entries(rec.value.relations)) {
            const rel = asRecord(relValue)
            if (!rel) continue
            if (typeof rel.sourceEntityId === 'string' && !validEntityIds.has(rel.sourceEntityId)) {
              return {
                ok: false,
                error: `Referential integrity violation: StoryState relation '${relId}' references non-existent sourceEntityId '${rel.sourceEntityId}'`,
              }
            }
            if (typeof rel.targetEntityId === 'string' && !validEntityIds.has(rel.targetEntityId)) {
              return {
                ok: false,
                error: `Referential integrity violation: StoryState relation '${relId}' references non-existent targetEntityId '${rel.targetEntityId}'`,
              }
            }
          }
        }
      }
    }

    // Atomic-style persistence with automatic rollback on failure (P0-1, INV-08)
    let rollbackLocalStorage: (() => void) | undefined
    try {
      rollbackLocalStorage = applyWorkspaceLocalStorage(remappedLocalStorageData)
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
        await this.purgeWorkspace(newWorkspaceId, undefined)
      } catch (rollbackError) {
        console.warn('[WorkspaceLifecycle] Workspace import rollback failed', rollbackError)
      }
      rollbackLocalStorage?.()
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
          newVolumes.length +
          newChapters.length +
          totalRemappedDomainRecords +
          remappedLocalStorageData.length +
          1,
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
        console.warn(
          `[WorkspaceLifecycle] Retrying purge tombstone failed for ${tombstone.workspaceId}:`,
          e,
        )
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
        console.warn(
          `Remote workspace.purge failed for ${workspaceId}; durable tombstone retained:`,
          e,
        )
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
    purgeWorkspaceLocalStorage(
      workspaceId,
      chapters.map((chapter) => chapter.id),
    )

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
