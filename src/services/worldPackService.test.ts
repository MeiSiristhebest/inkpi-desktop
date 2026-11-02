import { describe, expect, it, vi } from 'vitest'
import type { ProjectRecord } from '../types'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { ProjectQueryPort } from '../ports/projectQuery'
import type { CodexEntityRepository } from '../ports/codexEntityRepository'
import type { FormDataRepository } from '../ports/formDataRepository'
import type {
  NewWorldPackSnapshot,
  WorldPackSnapshotRepository,
} from '../ports/worldPackSnapshotRepository'
import type { WorldPackEntitySnapshot, WorldPackSnapshot } from '../domain/worldPacks/worldPack'
import { stableValue } from '../domain/worldPacks/worldPack'
import { WorldPackService } from './worldPackService'

const sourceProject: ProjectRecord = {
  id: 'world-pack-source',
  name: 'Source work',
  createdAt: 1,
  updatedAt: 1,
}
const targetProject: ProjectRecord = {
  id: 'world-pack-target',
  name: 'Target work',
  createdAt: 1,
  updatedAt: 1,
}

function codexEntity(overrides: Partial<CodexEntity> = {}): CodexEntity {
  return {
    id: 'entity-default',
    projectId: sourceProject.id,
    name: 'Default',
    aliases: [],
    category: 'character',
    attributes: {},
    relations: [],
    summary: 'Default summary',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function snapshotEntity(
  id: string,
  name: string,
  overrides: Partial<WorldPackEntitySnapshot> = {},
): WorldPackEntitySnapshot {
  return {
    id,
    name,
    aliases: [],
    category: 'character',
    attributes: {},
    relations: [],
    summary: `${name} summary`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function worldPack(
  worldbase: Record<string, unknown>,
  entities: WorldPackEntitySnapshot[],
): WorldPackSnapshot {
  return {
    id: 'world-pack-source-v1',
    schemaVersion: 1,
    sourceProjectId: sourceProject.id,
    sourceProjectName: sourceProject.name,
    version: 1,
    createdAt: 100,
    worldbase,
    entities,
  }
}

function createHarness(options?: {
  snapshot?: WorldPackSnapshot
  worldbase?: Record<string, unknown>
  entities?: CodexEntity[]
}) {
  const snapshots = new Map<string, WorldPackSnapshot>()
  if (options?.snapshot) snapshots.set(options.snapshot.id, structuredClone(options.snapshot))
  const projects = [sourceProject, targetProject]
  const formData = new Map<string, Record<string, unknown>>([
    [`${sourceProject.id}:worldbase`, {}],
    [`${targetProject.id}:worldbase`, structuredClone(options?.worldbase ?? {})],
  ])
  const entities = structuredClone(options?.entities ?? [])
  const snapshotsRepository: WorldPackSnapshotRepository = {
    list: async () => structuredClone([...snapshots.values()]),
    listBySourceProject: async (projectId) =>
      structuredClone([...snapshots.values()].filter((item) => item.sourceProjectId === projectId)),
    get: async (id) => {
      const result = snapshots.get(id)
      return result ? structuredClone(result) : undefined
    },
    createVersion: async (draft: NewWorldPackSnapshot) => {
      const version =
        Math.max(
          0,
          ...[...snapshots.values()]
            .filter((item) => item.sourceProjectId === draft.sourceProjectId)
            .map((item) => item.version),
        ) + 1
      const saved = { ...structuredClone(draft), version }
      snapshots.set(saved.id, structuredClone(saved))
      return structuredClone(saved)
    },
  }
  const projectRepository: ProjectQueryPort = {
    getAllProjects: async () => projects,
    getProject: async (id) => projects.find((project) => project.id === id),
    getAllVolumes: async () => [],
    getVolumesByProject: async () => [],
    getAllChapters: async () => [],
    getChaptersByProject: async () => [],
  }
  const forms: FormDataRepository = {
    getFormData: async (projectId, tabId) =>
      structuredClone(formData.get(`${projectId}:${tabId}`) ?? {}),
    saveFormData: vi.fn(async (projectId, tabId, nextData, expectedCurrentData) => {
      const key = `${projectId}:${tabId}`
      const current = formData.get(key) ?? {}
      if (
        expectedCurrentData !== undefined &&
        stableValue(current) !== stableValue(expectedCurrentData)
      ) {
        throw new Error('Form data changed while preparing the update.')
      }
      formData.set(key, structuredClone(nextData))
    }),
  }
  const codexRepository: CodexEntityRepository = {
    getAll: async () => structuredClone(entities),
    getByProject: async (projectId) =>
      structuredClone(entities.filter((entity) => entity.projectId === projectId)),
    save: vi.fn(async (entity) => {
      if (entities.some((current) => current.id === entity.id)) {
        throw new Error(`Entity id already exists: ${entity.id}`)
      }
      entities.push(structuredClone(entity))
    }),
    delete: vi.fn(async (id) => {
      const index = entities.findIndex((entity) => entity.id === id)
      if (index >= 0) entities.splice(index, 1)
    }),
  }
  const service = new WorldPackService({
    snapshots: snapshotsRepository,
    projects: projectRepository,
    forms,
    codexEntities: codexRepository,
    ids: { generate: (prefix) => `${prefix}-test-id` },
    clock: { now: () => 500 },
  })
  return { service, snapshots, formData, entities, forms, codexRepository }
}

describe('WorldPackService', () => {
  it('creates a detached source snapshot containing only that work’s worldbase and Codex', async () => {
    const sourceEntity = codexEntity({ id: 'source-codex', name: 'A character' })
    const otherWorkEntity = codexEntity({ id: 'other-codex', projectId: targetProject.id })
    const harness = createHarness({
      entities: [sourceEntity, otherWorkEntity],
    })
    harness.formData.set(`${sourceProject.id}:worldbase`, { rules: { magic: 'bounded' } })

    const created = await harness.service.createSnapshot(sourceProject.id)
    expect(created.version).toBe(1)
    expect(created.sourceProjectName).toBe(sourceProject.name)
    expect(created.worldbase).toEqual({ rules: { magic: 'bounded' } })
    expect(created.entities).toHaveLength(1)
    expect(created.entities[0]).not.toHaveProperty('projectId')

    harness.formData.set(`${sourceProject.id}:worldbase`, { rules: { magic: 'changed' } })
    expect(created.worldbase).toEqual({ rules: { magic: 'bounded' } })
  })

  it('adopts only missing data, preserves conflicts, remaps relations, and can be retried safely', async () => {
    const pack = worldPack({ missingRule: 'pack value', conflictingRule: 'pack conflict' }, [
      snapshotEntity('source-guild', 'Guild', { category: 'faction' }),
      snapshotEntity('source-existing', 'Existing', { summary: 'Pack version' }),
      snapshotEntity('source-new', 'New character', {
        relations: [
          { targetId: 'source-guild', targetName: 'Guild', relationType: 'member of' },
          { targetId: 'source-existing', targetName: 'Existing', relationType: 'rival' },
          { targetId: 'not-in-pack', targetName: 'Missing', relationType: 'rumored about' },
        ],
      }),
    ])
    const targetExisting = codexEntity({
      id: 'target-existing',
      projectId: targetProject.id,
      name: 'Existing',
      summary: 'Target version',
    })
    const targetOnly = codexEntity({
      id: 'target-only',
      projectId: targetProject.id,
      name: 'Target only',
    })
    const harness = createHarness({
      snapshot: pack,
      worldbase: { conflictingRule: 'target value', targetOnlyRule: 'keep' },
      entities: [targetExisting, targetOnly],
    })

    const result = await harness.service.adopt(pack.id, targetProject.id)

    expect(result).toEqual({
      addedWorldbaseFields: 1,
      addedEntities: 2,
      unresolvedRelations: 1,
      preservedConflictingWorldbaseFields: 1,
      preservedConflictingEntities: 1,
      ambiguousEntities: 0,
    })
    expect(harness.formData.get(`${targetProject.id}:worldbase`)).toEqual({
      conflictingRule: 'target value',
      targetOnlyRule: 'keep',
      missingRule: 'pack value',
    })
    expect(harness.entities.find((entity) => entity.id === targetExisting.id)?.summary).toBe(
      'Target version',
    )
    expect(harness.entities.find((entity) => entity.id === targetOnly.id)).toBeDefined()

    const imported = harness.entities.filter((entity) => entity.projectId === targetProject.id)
    const importedGuild = imported.find((entity) => entity.name === 'Guild')
    const importedNew = imported.find((entity) => entity.name === 'New character')
    expect(importedGuild?.id).toMatch(/^worldpack:/)
    expect(importedNew?.relations).toEqual([
      expect.objectContaining({ targetId: importedGuild?.id, targetName: 'Guild' }),
      expect.objectContaining({ targetId: targetExisting.id, targetName: 'Existing' }),
    ])
    expect(importedNew?.provenance?.createdBy).toBe(`world-pack:${pack.id}@${pack.version}`)
    expect(importedNew?.relations.some((relation) => relation.targetId === 'not-in-pack')).toBe(
      false,
    )

    const retry = await harness.service.adopt(pack.id, targetProject.id)
    expect(retry.addedWorldbaseFields).toBe(0)
    expect(retry.addedEntities).toBe(0)
    expect(harness.entities.filter((entity) => entity.projectId === targetProject.id)).toHaveLength(
      4,
    )
  })

  it('rejects a world-pack write when target form data changed after diff preparation', async () => {
    const pack = worldPack({ newRule: 'pack value' }, [])
    const harness = createHarness({ snapshot: pack, worldbase: {} })
    vi.mocked(harness.forms.saveFormData).mockRejectedValueOnce(
      new Error('Form data changed while preparing the update.'),
    )

    await expect(harness.service.adopt(pack.id, targetProject.id)).rejects.toThrow('safe to retry')
    expect(harness.formData.get(`${targetProject.id}:worldbase`)).toEqual({})
  })
})
