import { clock } from '../adapters/clock'
import { idGenerator } from '../adapters/idGenerator'
import { indexedDbReferenceSourceRepository } from '../adapters/indexedDbReferenceSourceRepository'
import {
  indexedDbSettingsKVRepository,
  type SettingsKVRecord,
} from '../adapters/indexedDbSettingsKVRepository'
import { db } from '../db/indexedDB'
import type { ExtractedLocalDocumentText } from './localDocumentText'
import {
  prepareReferenceMaterials,
  type PreparedReferenceMaterials,
  type ReferenceSourceRecord,
} from '../domain/references/referenceMaterials'
import type { ReferenceSourceRepository } from '../ports/referenceSourceRepository'

const PROJECT_REFERENCE_LINKS_KEY = 'reference-library-source-ids'
const MAX_TITLE_LENGTH = 160
const MAX_TAGS = 20

export interface ProjectReferenceSource {
  source: ReferenceSourceRecord
  attached: boolean
}

export interface CreateReferenceSourceInput {
  extracted: ExtractedLocalDocumentText
  title?: string
  tags?: string[]
}

export interface ProjectSettingsKeyValueRepository {
  get<T>(projectId: string, keyName: string, defaultValue: T): Promise<T>
  set<T>(projectId: string, keyName: string, value: T): Promise<void>
}

export interface ReferenceLibraryDependencies {
  sources?: ReferenceSourceRepository
  settings?: ProjectSettingsKeyValueRepository
  now?: () => number
  generateId?: (prefix: string) => string
  listSettingsRecords?: () => Promise<SettingsKVRecord<unknown>[]>
}

export class ReferenceLibraryService {
  private readonly sources: ReferenceSourceRepository
  private readonly settings: ProjectSettingsKeyValueRepository
  private readonly now: () => number
  private readonly generateId: (prefix: string) => string
  private readonly listSettingsRecords: () => Promise<SettingsKVRecord<unknown>[]>

  constructor(dependencies: ReferenceLibraryDependencies = {}) {
    this.sources = dependencies.sources ?? indexedDbReferenceSourceRepository
    this.settings = dependencies.settings ?? indexedDbSettingsKVRepository
    this.now = dependencies.now ?? (() => clock.now())
    this.generateId = dependencies.generateId ?? ((prefix) => idGenerator.generate(prefix))
    this.listSettingsRecords = dependencies.listSettingsRecords ?? (() => db.getAll('settingsKV'))
  }

  async listSources(): Promise<ReferenceSourceRecord[]> {
    return (await this.sources.getAll()).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }

  async listProjectSources(projectId: string): Promise<ProjectReferenceSource[]> {
    const linkedIds = new Set(await this.getProjectSourceIds(projectId))
    const allSources = await this.listSources()
    return allSources.map((source) => ({ source, attached: linkedIds.has(source.id) }))
  }

  async createSource(input: CreateReferenceSourceInput): Promise<ReferenceSourceRecord> {
    const text = input.extracted.text.trim()
    if (!text) throw new Error('参考资料没有可保存的文字内容。')

    const now = this.now()
    const source: ReferenceSourceRecord = {
      id: this.generateId('reference'),
      title: normalizeTitle(input.title, input.extracted.fileName),
      originalFileName: input.extracted.fileName,
      format: input.extracted.format,
      text,
      tags: normalizeTags(input.tags ?? []),
      contentFingerprint: fingerprintText(text),
      importedAt: now,
      updatedAt: now,
    }
    await this.sources.save(source)
    return source
  }

  async attachToProject(projectId: string, sourceId: string): Promise<void> {
    const source = await this.sources.getById(sourceId)
    if (!source) throw new Error('参考资料已不存在，请刷新资料库。')
    const current = await this.getProjectSourceIds(projectId)
    if (current.includes(sourceId)) return
    await this.settings.set(projectId, PROJECT_REFERENCE_LINKS_KEY, [...current, sourceId])
  }

  async detachFromProject(projectId: string, sourceId: string): Promise<void> {
    const current = await this.getProjectSourceIds(projectId)
    await this.settings.set(
      projectId,
      PROJECT_REFERENCE_LINKS_KEY,
      current.filter((id) => id !== sourceId),
    )
  }

  async getProjectSourceIds(projectId: string): Promise<string[]> {
    if (!projectId.trim()) return []
    const value = await this.settings.get<unknown>(projectId, PROJECT_REFERENCE_LINKS_KEY, [])
    if (!Array.isArray(value)) return []
    return [
      ...new Set(
        value.filter((item): item is string => typeof item === 'string' && item.length > 0),
      ),
    ]
  }

  async prepareForTask(
    projectId: string,
    selectedSourceIds: readonly string[],
    query: string,
    maxCharacters: number,
  ): Promise<PreparedReferenceMaterials> {
    const linkedIds = new Set(await this.getProjectSourceIds(projectId))
    const attachedSources = (await this.listSources()).filter((source) => linkedIds.has(source.id))
    const selectedIds = selectedSourceIds.filter((id) => linkedIds.has(id))
    return prepareReferenceMaterials(attachedSources, selectedIds, query, maxCharacters)
  }

  async exportProjectSources(projectId: string): Promise<ReferenceSourceRecord[]> {
    const linkedIds = new Set(await this.getProjectSourceIds(projectId))
    return (await this.listSources()).filter((source) => linkedIds.has(source.id))
  }

  async importArchivedSources(sources: readonly ReferenceSourceRecord[]): Promise<string[]> {
    const existingById = new Map((await this.sources.getAll()).map((source) => [source.id, source]))
    const toCreate: ReferenceSourceRecord[] = []
    for (const source of sources) {
      validateArchivedSource(source)
      const existing = existingById.get(source.id)
      if (existing && existing.contentFingerprint !== source.contentFingerprint) {
        throw new Error(`参考资料编号冲突：${source.title}`)
      }
      if (!existing) toCreate.push(source)
    }

    const saved: string[] = []
    try {
      for (const source of toCreate) {
        await this.sources.save(source)
        saved.push(source.id)
      }
      return saved
    } catch (error) {
      await Promise.all(saved.map((id) => this.sources.delete(id).catch(() => undefined)))
      throw error
    }
  }

  async deleteUnlinkedSource(sourceId: string): Promise<void> {
    const linkRecords = await this.listSettingsRecords()
    const isLinked = linkRecords.some((record) => {
      if (!record.key.endsWith(`::${PROJECT_REFERENCE_LINKS_KEY}`)) return false
      return Array.isArray(record.value) && record.value.includes(sourceId)
    })
    if (isLinked) throw new Error('该资料仍关联到至少一个作品；请先从作品中解除关联。')
    await this.sources.delete(sourceId)
  }
}

export const referenceLibraryService = new ReferenceLibraryService()

function normalizeTitle(title: string | undefined, fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/u, '')
  const normalized = (title ?? '').trim() || withoutExtension || '未命名参考资料'
  return normalized.slice(0, MAX_TITLE_LENGTH)
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, MAX_TAGS)
    .map((tag) => tag.slice(0, 60))
}

function fingerprintText(text: string): string {
  let hashA = 0x811c9dc5
  let hashB = 0x01000193
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charCodeAt(index)
    hashA = Math.imul(hashA ^ character, 0x01000193)
    hashB = Math.imul(hashB ^ character, 0x811c9dc5)
  }
  return `fnv1a32:${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0).toString(16).padStart(8, '0')}:${text.length}`
}

function validateArchivedSource(source: ReferenceSourceRecord): void {
  if (
    !source ||
    typeof source.id !== 'string' ||
    typeof source.title !== 'string' ||
    typeof source.text !== 'string' ||
    typeof source.contentFingerprint !== 'string' ||
    !['txt', 'md', 'docx'].includes(source.format)
  ) {
    throw new Error('备份中的参考资料格式无效。')
  }
  if (source.text.length > 5_000_000) throw new Error('备份中的参考资料超过 500 万字符。')
}
