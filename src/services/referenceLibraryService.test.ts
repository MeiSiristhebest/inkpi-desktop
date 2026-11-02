import { describe, expect, it } from 'vitest'
import type { ReferenceSourceRecord } from '../domain/references/referenceMaterials'
import type { ReferenceSourceRepository } from '../ports/referenceSourceRepository'
import {
  ReferenceLibraryService,
  type ProjectSettingsKeyValueRepository,
} from './referenceLibraryService'

class MemoryReferenceSources implements ReferenceSourceRepository {
  records = new Map<string, ReferenceSourceRecord>()

  async getAll() {
    return [...this.records.values()]
  }

  async getById(id: string) {
    return this.records.get(id)
  }

  async save(source: ReferenceSourceRecord) {
    this.records.set(source.id, source)
  }

  async delete(id: string) {
    this.records.delete(id)
  }
}

class MemoryProjectSettings implements ProjectSettingsKeyValueRepository {
  records = new Map<string, unknown>()

  async get<T>(projectId: string, keyName: string, defaultValue: T): Promise<T> {
    return (this.records.get(`${projectId}::${keyName}`) as T | undefined) ?? defaultValue
  }

  async set<T>(projectId: string, keyName: string, value: T): Promise<void> {
    this.records.set(`${projectId}::${keyName}`, value)
  }
}

const extracted = {
  fileName: 'urban-notes.md',
  format: 'md' as const,
  text: '北京地铁线路改变城市通勤。',
  warnings: [],
}

const sourceRecord = (overrides: Partial<ReferenceSourceRecord> = {}): ReferenceSourceRecord => ({
  id: 'ref-archive',
  title: '城市交通',
  originalFileName: 'city.md',
  format: 'md',
  text: '北京地铁线路改变城市通勤。',
  tags: ['都市'],
  contentFingerprint: 'same-content',
  importedAt: 1,
  updatedAt: 1,
  ...overrides,
})

function createService(
  sources = new MemoryReferenceSources(),
  settings = new MemoryProjectSettings(),
  listSettingsRecords: () => Promise<Array<{ key: string; value: unknown }>> = async () => [],
) {
  const service = new ReferenceLibraryService({
    sources,
    settings,
    now: () => 50,
    generateId: (prefix) => `${prefix}-generated`,
    listSettingsRecords,
  })
  return { service, sources, settings }
}

describe('ReferenceLibraryService', () => {
  it('creates a local source with normalized metadata and a content fingerprint', async () => {
    const { service, sources } = createService()

    const created = await service.createSource({ extracted, tags: [' 都市 ', '', '都市'] })

    expect(created).toMatchObject({
      id: 'reference-generated',
      title: 'urban-notes',
      format: 'md',
      text: extracted.text,
      tags: ['都市'],
      importedAt: 50,
      updatedAt: 50,
    })
    expect(created.contentFingerprint).toMatch(/^fnv1a32:/)
    expect(await sources.getById(created.id)).toEqual(created)
  })

  it('keeps project attachments isolated and idempotent', async () => {
    const { service, sources, settings } = createService()
    const source = sourceRecord()
    await sources.save(source)

    await service.attachToProject('project-a', source.id)
    await service.attachToProject('project-a', source.id)
    await service.attachToProject('project-b', source.id)
    await service.detachFromProject('project-a', source.id)

    expect(await service.getProjectSourceIds('project-a')).toEqual([])
    expect(await service.getProjectSourceIds('project-b')).toEqual([source.id])
    expect(settings.records.get('project-b::reference-library-source-ids')).toEqual([source.id])
  })

  it('prepares task context only from sources linked to that project', async () => {
    const { service, sources } = createService()
    const linked = sourceRecord()
    const unlinked = sourceRecord({ id: 'ref-unlinked', title: '不应自动附加' })
    await sources.save(linked)
    await sources.save(unlinked)
    await service.attachToProject('project-a', linked.id)

    const prepared = await service.prepareForTask(
      'project-a',
      [linked.id, unlinked.id],
      '北京地铁',
      300,
    )

    expect(prepared.excerpts).toHaveLength(1)
    expect(prepared.excerpts[0].sourceId).toBe(linked.id)
    expect(prepared.disclosure.sources).toEqual([
      expect.objectContaining({ sourceId: linked.id, selected: true, includedPassages: 1 }),
    ])
  })

  it('refuses to delete a source linked by any project', async () => {
    const source = sourceRecord()
    const { service, sources } = createService(undefined, undefined, async () => [
      { key: 'project-a::reference-library-source-ids', value: [source.id] },
      { key: 'project-b::other-setting', value: [source.id] },
    ])
    await sources.save(source)

    await expect(service.deleteUnlinkedSource(source.id)).rejects.toThrow('仍关联到至少一个作品')
    expect(await sources.getById(source.id)).toEqual(source)
  })

  it('imports missing archived sources but rejects a conflicting ID without overwriting', async () => {
    const { service, sources } = createService()
    const original = sourceRecord()
    const archived = sourceRecord({ id: 'ref-imported' })
    await sources.save(original)

    expect(await service.importArchivedSources([archived])).toEqual(['ref-imported'])
    await expect(
      service.importArchivedSources([
        sourceRecord({ id: original.id, contentFingerprint: 'different-content' }),
      ]),
    ).rejects.toThrow('编号冲突')
    expect(await sources.getById(original.id)).toEqual(original)
  })
})
