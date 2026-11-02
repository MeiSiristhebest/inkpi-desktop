import { indexedDbWorldPackSnapshotRepository } from '../adapters/indexedDbWorldPackSnapshotRepository'
import { clock } from '../adapters/clock'
import { idGenerator } from '../adapters/idGenerator'
import { indexedDbCodexEntityRepository } from '../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { defaultFormDataRepository } from '../adapters/indexedDbFormDataRepository'
import {
  cloneWorldPackValue,
  compareWorldPack,
  isBlank,
  WORLD_BASE_FORM_ID,
  WORLD_PACK_SCHEMA_VERSION,
  type WorldPackDiff,
  type WorldPackEntitySnapshot,
  type WorldPackSnapshot,
} from '../domain/worldPacks/worldPack'
import { createProvenance } from '../domain/story/provenance'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { Clock } from '../ports/clock'
import type { CodexEntityRepository } from '../ports/codexEntityRepository'
import type { FormDataRepository } from '../ports/formDataRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { ProjectQueryPort } from '../ports/projectQuery'
import type { WorldPackSnapshotRepository } from '../ports/worldPackSnapshotRepository'

export interface WorldPackAdoptionResult {
  addedWorldbaseFields: number
  addedEntities: number
  unresolvedRelations: number
  preservedConflictingWorldbaseFields: number
  preservedConflictingEntities: number
  ambiguousEntities: number
}

export interface WorldPackServiceDependencies {
  snapshots: WorldPackSnapshotRepository
  projects: ProjectQueryPort
  forms: FormDataRepository
  codexEntities: CodexEntityRepository
  ids: IdGenerator
  clock: Clock
}

export class WorldPackService {
  private readonly dependencies: WorldPackServiceDependencies

  constructor(dependencies: WorldPackServiceDependencies) {
    this.dependencies = dependencies
  }

  async listSnapshots(): Promise<WorldPackSnapshot[]> {
    const snapshots = await this.dependencies.snapshots.list()
    return snapshots.sort(
      (a, b) => b.createdAt - a.createdAt || b.version - a.version || a.id.localeCompare(b.id),
    )
  }

  async createSnapshot(projectId: string): Promise<WorldPackSnapshot> {
    const project = await this.dependencies.projects.getProject(projectId)
    if (!project) throw new Error('The source work could not be found.')
    const [worldbase, sourceEntities] = await Promise.all([
      this.dependencies.forms.getFormData(projectId, WORLD_BASE_FORM_ID),
      this.dependencies.codexEntities.getByProject(projectId),
    ])
    const entities = sourceEntities
      .flatMap((entity) => (entity.projectId === projectId ? [toSnapshotEntity(entity)] : []))
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      )
    if (!Object.values(worldbase).some((value) => !isBlank(value)) && entities.length === 0) {
      throw new Error('Add worldbase details or Codex entities before creating a snapshot.')
    }
    return this.dependencies.snapshots.createVersion({
      id: this.dependencies.ids.generate('world-pack'),
      schemaVersion: WORLD_PACK_SCHEMA_VERSION,
      sourceProjectId: projectId,
      sourceProjectName: project.name,
      createdAt: this.dependencies.clock.now(),
      worldbase: cloneWorldPackValue(worldbase),
      entities: cloneWorldPackValue(entities),
    })
  }

  async compare(snapshotId: string, targetProjectId: string): Promise<WorldPackDiff> {
    const snapshot = await this.requireSnapshot(snapshotId)
    const [targetWorldbase, targetEntities] = await this.readTarget(targetProjectId)
    return compareWorldPack(snapshot, targetWorldbase, targetEntities.map(toSnapshotEntity))
  }

  async adopt(snapshotId: string, targetProjectId: string): Promise<WorldPackAdoptionResult> {
    const snapshot = await this.requireSnapshot(snapshotId)
    if (!(await this.dependencies.projects.getProject(targetProjectId))) {
      throw new Error('The target work could not be found.')
    }
    const [targetWorldbase, currentEntities] = await this.readTarget(targetProjectId)
    const plan = buildAdoptionPlan(
      snapshot,
      targetProjectId,
      targetWorldbase,
      currentEntities,
      this.dependencies.clock,
    )
    return this.persistAdoptionPlan(targetProjectId, plan)
  }

  private async persistAdoptionPlan(
    targetProjectId: string,
    plan: WorldPackAdoptionPlan,
  ): Promise<WorldPackAdoptionResult> {
    let addedWorldbaseFields = 0
    let addedEntities = 0
    try {
      if (plan.mergedWorldbase && plan.expectedWorldbase) {
        await this.dependencies.forms.saveFormData(
          targetProjectId,
          WORLD_BASE_FORM_ID,
          plan.mergedWorldbase,
          plan.expectedWorldbase,
        )
        addedWorldbaseFields = plan.addedWorldbaseFields
      }
      for (const entity of plan.entities) {
        await this.dependencies.codexEntities.save(entity)
        addedEntities += 1
      }
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Adoption stopped after adding ${addedWorldbaseFields} worldbase field(s) and ${addedEntities} entity/entities. The operation is safe to retry: ${cause}`,
      )
    }
    return {
      addedWorldbaseFields,
      addedEntities,
      unresolvedRelations: plan.unresolvedRelations,
      preservedConflictingWorldbaseFields: plan.preservedConflictingWorldbaseFields,
      preservedConflictingEntities: plan.preservedConflictingEntities,
      ambiguousEntities: plan.ambiguousEntities,
    }
  }

  private async requireSnapshot(snapshotId: string): Promise<WorldPackSnapshot> {
    const snapshot = await this.dependencies.snapshots.get(snapshotId)
    if (!snapshot) throw new Error('The selected world-pack snapshot no longer exists.')
    if (snapshot.schemaVersion !== WORLD_PACK_SCHEMA_VERSION) {
      throw new Error(`Unsupported world-pack schema version: ${snapshot.schemaVersion}`)
    }
    return snapshot
  }

  private async readTarget(projectId: string): Promise<[Record<string, unknown>, CodexEntity[]]> {
    const [worldbase, entities] = await Promise.all([
      this.dependencies.forms.getFormData(projectId, WORLD_BASE_FORM_ID),
      this.dependencies.codexEntities.getByProject(projectId),
    ])
    return [worldbase, entities.filter((entity) => entity.projectId === projectId)]
  }
}

interface WorldPackAdoptionPlan {
  mergedWorldbase?: Record<string, unknown>
  expectedWorldbase?: Record<string, unknown>
  addedWorldbaseFields: number
  entities: CodexEntity[]
  unresolvedRelations: number
  preservedConflictingWorldbaseFields: number
  preservedConflictingEntities: number
  ambiguousEntities: number
}

const CODEX_CATEGORIES: ReadonlySet<string> = new Set([
  'character',
  'faction',
  'location',
  'item',
  'race',
  'history',
  'term',
])

function buildAdoptionPlan(
  snapshot: WorldPackSnapshot,
  targetProjectId: string,
  targetWorldbase: Record<string, unknown>,
  targetEntities: CodexEntity[],
  time: Clock,
): WorldPackAdoptionPlan {
  const diff = compareWorldPack(snapshot, targetWorldbase, targetEntities.map(toSnapshotEntity))
  const fieldsToAdd = diff.fields.filter((field) => field.status === 'add')
  const entityIds = createAdoptedEntityIdMap(snapshot, targetProjectId, diff.entities)
  const sourceById = new Map(snapshot.entities.map((entity) => [entity.id, entity]))
  const targetById = new Map(targetEntities.map((entity) => [entity.id, entity]))
  const unresolved = { count: 0 }
  const entities = diff.entities
    .filter((entity) => entity.status === 'add')
    .map(({ sourceEntity }) =>
      toAdoptedEntity(
        snapshot,
        sourceEntity,
        targetProjectId,
        entityIds,
        sourceById,
        targetById,
        time.now(),
        unresolved,
      ),
    )
  let mergedWorldbase: Record<string, unknown> | undefined
  if (fieldsToAdd.length > 0) {
    mergedWorldbase = cloneWorldPackValue(targetWorldbase)
    for (const field of fieldsToAdd) {
      mergedWorldbase[field.field] = cloneWorldPackValue(field.sourceValue)
    }
  }
  return {
    ...(mergedWorldbase === undefined
      ? {}
      : { mergedWorldbase, expectedWorldbase: targetWorldbase }),
    addedWorldbaseFields: fieldsToAdd.length,
    entities,
    unresolvedRelations: unresolved.count,
    preservedConflictingWorldbaseFields: diff.counts.conflictingFields,
    preservedConflictingEntities: diff.counts.conflictingEntities,
    ambiguousEntities: diff.counts.ambiguousEntities,
  }
}

function createAdoptedEntityIdMap(
  snapshot: WorldPackSnapshot,
  targetProjectId: string,
  diffs: WorldPackDiff['entities'],
): Map<string, string> {
  const entityIds = new Map<string, string>()
  for (const entityDiff of diffs) {
    if (
      (entityDiff.status === 'same' || entityDiff.status === 'conflict') &&
      entityDiff.matchingTargets.length === 1
    ) {
      entityIds.set(entityDiff.sourceEntity.id, entityDiff.matchingTargets[0].id)
    } else if (entityDiff.status === 'add') {
      entityIds.set(
        entityDiff.sourceEntity.id,
        adoptedEntityId(snapshot, targetProjectId, entityDiff.sourceEntity.id),
      )
    }
  }
  return entityIds
}

function toAdoptedEntity(
  snapshot: WorldPackSnapshot,
  sourceEntity: WorldPackEntitySnapshot,
  targetProjectId: string,
  entityIds: ReadonlyMap<string, string>,
  sourceById: ReadonlyMap<string, WorldPackEntitySnapshot>,
  targetById: ReadonlyMap<string, CodexEntity>,
  now: number,
  unresolved: { count: number },
): CodexEntity {
  if (!CODEX_CATEGORIES.has(sourceEntity.category)) {
    throw new Error(`Unsupported Codex category in snapshot: ${sourceEntity.category}`)
  }
  const id = entityIds.get(sourceEntity.id)
  if (!id) throw new Error(`Could not assign an adoption id for ${sourceEntity.name}.`)
  const relations = sourceEntity.relations.flatMap((relation) => {
    const targetId = entityIds.get(relation.targetId)
    if (!targetId) {
      unresolved.count += 1
      return []
    }
    const targetName =
      targetById.get(targetId)?.name ??
      sourceById.get(relation.targetId)?.name ??
      relation.targetName
    return [{ ...cloneWorldPackValue(relation), targetId, targetName }]
  })
  const parentId = sourceEntity.parentId ? entityIds.get(sourceEntity.parentId) : undefined
  const provenance = sourceEntity.provenance
    ? createProvenance({ ...sourceEntity.provenance, createdBy: packOrigin(snapshot) })
    : createProvenance({
        sourceType: 'derived',
        factLevel: 'canonical-fact',
        createdAt: now,
        createdBy: packOrigin(snapshot),
      })
  const entity: CodexEntity = {
    id,
    projectId: targetProjectId,
    name: sourceEntity.name,
    aliases: cloneWorldPackValue(sourceEntity.aliases),
    category: sourceEntity.category as CodexEntity['category'],
    attributes: cloneWorldPackValue(sourceEntity.attributes),
    relations,
    summary: sourceEntity.summary,
    createdAt: now,
    updatedAt: now,
    provenance,
  }
  if (parentId) entity.parentId = parentId
  if (sourceEntity.detailMarkdown !== undefined) entity.detailMarkdown = sourceEntity.detailMarkdown
  return entity
}

function toSnapshotEntity(entity: CodexEntity): WorldPackEntitySnapshot {
  const snapshotEntity: WorldPackEntitySnapshot = {
    id: entity.id,
    name: entity.name,
    aliases: cloneWorldPackValue(entity.aliases),
    category: entity.category,
    attributes: cloneWorldPackValue(entity.attributes),
    relations: cloneWorldPackValue(entity.relations),
    summary: entity.summary,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
  if (entity.parentId !== undefined) snapshotEntity.parentId = entity.parentId
  if (entity.detailMarkdown !== undefined) snapshotEntity.detailMarkdown = entity.detailMarkdown
  if (entity.provenance !== undefined)
    snapshotEntity.provenance = cloneWorldPackValue(entity.provenance)
  return snapshotEntity
}

function adoptedEntityId(
  snapshot: WorldPackSnapshot,
  targetProjectId: string,
  sourceId: string,
): string {
  return [
    'worldpack',
    encodeURIComponent(targetProjectId),
    encodeURIComponent(snapshot.id),
    encodeURIComponent(sourceId),
  ].join(':')
}

function packOrigin(snapshot: WorldPackSnapshot): string {
  return `world-pack:${snapshot.id}@${snapshot.version}`
}

export const worldPackService = new WorldPackService({
  snapshots: indexedDbWorldPackSnapshotRepository,
  projects: indexedDbProjectRepository,
  forms: defaultFormDataRepository,
  codexEntities: indexedDbCodexEntityRepository,
  ids: idGenerator,
  clock,
})
