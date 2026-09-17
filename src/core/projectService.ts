import type { ProjectRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { FileDownloader } from '../ports/fileDownloader'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { blobFileDownloader } from '../adapters/blobFileDownloader'
import { idGenerator as defaultIdGenerator } from '../adapters/idGenerator'
import { clock as defaultClock } from '../adapters/clock'
import { buildSeedVolumes, buildSeedChapters, buildBlankVolumes, buildBlankChapters } from '../domain/seed'
import { LEGACY_PROJECT_ID } from '../config'
import { workspaceLifecycleService } from '../services/workspaceLifecycleService'

// ─────────────────────────────────────────────────────────────
// 项目应用服务（原 projectManager）
//
// 依赖倒置原则（DIP）：本模块只依赖抽象端口（ProjectRepository / FileDownloader），
// 不直接 import IndexedDB 单例，也不直接操作 document 触发下载。
// 默认实现由模块级常量注入（IndexedDB 适配器 + Blob 下载器 + 默认 ID 生成器 + 时钟），
// 不再持有可被任意写入的模块级可变状态（评审 §6.3）；测试通过注入式端口或内存实现覆盖。
// ─────────────────────────────────────────────────────────────

const projectRepo: ProjectRepository = indexedDbProjectRepository
const fileDownloader: FileDownloader = blobFileDownloader
const idGen: IdGenerator = defaultIdGenerator
const clock: Clock = defaultClock

export interface ProjectStats {
  words: number
  chapters: number
  volumes: number
  lastUpdated: number
}

export interface WorkspaceStats {
  totalWords: number
  totalChapters: number
  activeThisWeek: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 单项目聚合统计：字数 / 章节数 / 卷数 / 最近更新时间（全部取自真实数据） */
export async function loadProjectStats(projectId: string): Promise<ProjectStats> {
  const [vols, chs] = await Promise.all([projectRepo.getAllVolumes(), projectRepo.getAllChapters()])
  const pv = vols.filter((v) => v.projectId === projectId)
  const pc = chs.filter((c) => c.projectId === projectId)
  return {
    words: pc.reduce((a, c) => a + (c.wordCount || 0), 0),
    chapters: pc.length,
    volumes: pv.length,
    lastUpdated: pc.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0),
  }
}

/** 批量聚合多个项目的统计，返回以 projectId 为键的映射 */
export async function loadStatsForProjects(
  projects: ProjectRecord[],
): Promise<Record<string, ProjectStats>> {
  const [vols, chs] = await Promise.all([projectRepo.getAllVolumes(), projectRepo.getAllChapters()])
  const map: Record<string, ProjectStats> = {}
  for (const p of projects) {
    const pv = vols.filter((v) => v.projectId === p.id)
    const pc = chs.filter((c) => c.projectId === p.id)
    map[p.id] = {
      words: pc.reduce((a, c) => a + (c.wordCount || 0), 0),
      chapters: pc.length,
      volumes: pv.length,
      lastUpdated: pc.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0),
    }
  }
  return map
}

/** 整个工作区的聚合统计，用于工作台首页的总览条 */
export async function loadWorkspaceStats(projects: ProjectRecord[]): Promise<WorkspaceStats> {
  const chs = await projectRepo.getAllChapters()
  const pids = new Set(projects.map((p) => p.id))
  const pchs = chs.filter((c) => pids.has(c.projectId))
  const weekAgo = clock.now() - WEEK_MS
  const active = new Set(pchs.filter((c) => (c.updatedAt || 0) >= weekAgo).map((c) => c.projectId))
  return {
    totalWords: pchs.reduce((a, c) => a + (c.wordCount || 0), 0),
    totalChapters: pchs.length,
    activeThisWeek: active.size,
  }
}

/**
 * 旧版本迁移：若没有任何显式项目，但存在默认项目（LEGACY_PROJECT_ID）的卷章数据，
 * 则自动生成一条可显式管理的项目记录，避免老用户升级后书架空无一物。
 */
async function migrateLegacyIfNeeded(): Promise<void> {
  const existing = await projectRepo.getAllProjects()
  if (existing.length > 0) return
  const volumes = await projectRepo.getAllVolumes()
  if (!volumes.some((v) => v.projectId === LEGACY_PROJECT_ID)) return
  const now = clock.now()
  const migrated: ProjectRecord = {
    id: LEGACY_PROJECT_ID,
    name: '默认项目',
    genre: '未分类',
    intro: '从旧版本迁移的项目',
    createdAt: now,
    updatedAt: now,
  }
  await projectRepo.saveProject(migrated)
}

export async function loadProjects(): Promise<ProjectRecord[]> {
  await migrateLegacyIfNeeded()
  return projectRepo.getAllProjects()
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return projectRepo.getProject(id)
}

export async function createProject(
  name: string,
  genre = '未分类',
  intro = '',
  templateType: 'blank' | 'demo' = 'blank',
): Promise<ProjectRecord> {
  const now = clock.now()
  const project: ProjectRecord = {
    id: idGen.generate('proj'),
    name,
    genre,
    intro,
    templateType,
    createdAt: now,
    updatedAt: now,
  }

  await projectRepo.saveProject(project)

  // INV-05: 严格分离 Blank 与 Demo。普通新项目默认生成单卷单空章，不得静默注入“林凡/玄剑宗”示范事实
  const isDemo = templateType === 'demo'
  const volumes = isDemo
    ? buildSeedVolumes(project.id, idGen, clock)
    : buildBlankVolumes(project.id, idGen, clock)
  const chapters = isDemo
    ? buildSeedChapters(project.id, volumes[0]?.id, idGen, clock)
    : buildBlankChapters(project.id, volumes[0]?.id, idGen, clock)

  await Promise.all(volumes.map((v) => projectRepo.saveVolume(v)))
  await Promise.all(chapters.map((c) => projectRepo.saveChapter(c)))

  return project
}

/** 导入项目的结果：成功携带 project，失败携带可读错误（不再以 null 吞掉异常，评审 §4.1） */
export type ProjectImportResult =
  { ok: true; project: ProjectRecord } | { ok: false; error: string }

export async function importProject(file: File): Promise<ProjectImportResult> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const result = await workspaceLifecycleService.importWorkspace(data)
    if (!result.ok || !result.project) {
      return { ok: false, error: result.error || '导入工作区失败' }
    }
    return { ok: true, project: result.project }
  } catch (e) {
    console.warn('Import project failed:', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateProject(project: ProjectRecord): Promise<void> {
  await projectRepo.saveProject({ ...project, updatedAt: clock.now() })
}

/** 导出项目完整备份（遵循 INV-04）：元数据、卷章正文与 40+ 领域表数据完整归档 */
export async function exportProject(projectId: string): Promise<void> {
  const archive = await workspaceLifecycleService.exportWorkspaceBackup(projectId)
  if (!archive) return

  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })
  fileDownloader.downloadBlob(
    `${archive.project.name || 'inkpi-project'}-workspace-backup-${new Date(clock.now()).toISOString().slice(0, 10)}.json`,
    blob,
  )
}

/** 删除/永久清除工作区数据（级联清除卷章与领域插件数据） */
export async function deleteProject(projectId: string): Promise<void> {
  await workspaceLifecycleService.purgeWorkspace(projectId)
}

/** 一键创建示范项目：自带种子卷章，便于第一次使用即体验完整功能 */
export async function createDemoProject(): Promise<ProjectRecord> {
  return createProject(
    '示范 · 苍澜纪元',
    '仙侠修真',
    '废脉少年于测灵大典觉醒，吞噬进化，从杂役一路镇压神族。',
    'demo',
  )
}

