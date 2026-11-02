import type { Provenance } from '../story/provenance'

export const WORLD_PACK_SCHEMA_VERSION = 1
export const WORLD_BASE_FORM_ID = 'worldbase'

export interface WorldPackEntityRelation {
  targetId: string
  targetName: string
  relationType: string
  description?: string
}

/** A portable Codex projection that deliberately omits the source project's tenant id. */
export interface WorldPackEntitySnapshot {
  id: string
  name: string
  aliases: string[]
  category: string
  parentId?: string
  attributes: Record<string, string | number | boolean>
  relations: WorldPackEntityRelation[]
  summary: string
  detailMarkdown?: string
  createdAt: number
  updatedAt: number
  provenance?: Provenance
}

/** One append-only, versioned copy of a work's worldbase form and Codex graph. */
export interface WorldPackSnapshot {
  id: string
  schemaVersion: typeof WORLD_PACK_SCHEMA_VERSION
  sourceProjectId: string
  sourceProjectName: string
  version: number
  createdAt: number
  worldbase: Record<string, unknown>
  entities: WorldPackEntitySnapshot[]
}

export type WorldPackEntityDiffStatus = 'add' | 'same' | 'conflict' | 'ambiguous'

export interface WorldPackFieldDiff {
  field: string
  status: 'add' | 'same' | 'conflict'
  sourceValue: unknown
  targetValue: unknown
}

export interface WorldPackEntityDiff {
  sourceEntity: WorldPackEntitySnapshot
  status: WorldPackEntityDiffStatus
  matchingTargets: WorldPackEntitySnapshot[]
}

export interface WorldPackDiff {
  fields: WorldPackFieldDiff[]
  targetOnlyFields: Array<{ field: string; targetValue: unknown }>
  entities: WorldPackEntityDiff[]
  targetOnlyEntities: WorldPackEntitySnapshot[]
  counts: {
    fieldsToAdd: number
    sameFields: number
    conflictingFields: number
    targetOnlyFields: number
    entitiesToAdd: number
    sameEntities: number
    conflictingEntities: number
    ambiguousEntities: number
    targetOnlyEntities: number
  }
}

export function compareWorldPack(
  snapshot: WorldPackSnapshot,
  targetWorldbase: Record<string, unknown>,
  targetEntities: readonly WorldPackEntitySnapshot[],
): WorldPackDiff {
  const providedWorldbase = new Set(
    Object.entries(snapshot.worldbase)
      .filter(([, value]) => !isBlank(value))
      .map(([field]) => field),
  )
  const fields: WorldPackFieldDiff[] = Object.entries(snapshot.worldbase)
    .filter(([, value]) => !isBlank(value))
    .map(([field, sourceValue]) => {
      const targetValue = targetWorldbase[field]
      const status =
        isBlank(targetValue) || !Object.hasOwn(targetWorldbase, field)
          ? 'add'
          : stableValue(sourceValue) === stableValue(targetValue)
            ? 'same'
            : 'conflict'
      return { field, status, sourceValue, targetValue }
    })
  const targetOnlyFields = Object.entries(targetWorldbase)
    .filter(([field, value]) => !providedWorldbase.has(field) && !isBlank(value))
    .map(([field, targetValue]) => ({ field, targetValue }))

  const sourceKeyCounts = countEntityKeys(snapshot.entities)
  const targetByKey = new Map<string, WorldPackEntitySnapshot[]>()
  for (const entity of targetEntities) {
    const key = entityKey(entity)
    targetByKey.set(key, [...(targetByKey.get(key) ?? []), entity])
  }
  const sourceById = new Map(snapshot.entities.map((entity) => [entity.id, entity]))
  const targetById = new Map(targetEntities.map((entity) => [entity.id, entity]))
  const entities: WorldPackEntityDiff[] = snapshot.entities.map((sourceEntity) => {
    const matches = targetByKey.get(entityKey(sourceEntity)) ?? []
    if ((sourceKeyCounts.get(entityKey(sourceEntity)) ?? 0) > 1 || matches.length > 1) {
      return { sourceEntity, status: 'ambiguous', matchingTargets: matches }
    }
    if (matches.length === 0) return { sourceEntity, status: 'add', matchingTargets: [] }
    const targetEntity = matches[0]
    return {
      sourceEntity,
      status:
        entitySignature(sourceEntity, sourceById) === entitySignature(targetEntity, targetById)
          ? 'same'
          : 'conflict',
      matchingTargets: matches,
    }
  })
  const sourceKeys = new Set(sourceKeyCounts.keys())
  const targetOnlyEntities = targetEntities.filter((entity) => !sourceKeys.has(entityKey(entity)))

  const count = (status: WorldPackEntityDiffStatus) =>
    entities.filter((entity) => entity.status === status).length
  return {
    fields,
    targetOnlyFields,
    entities,
    targetOnlyEntities,
    counts: {
      fieldsToAdd: fields.filter((field) => field.status === 'add').length,
      sameFields: fields.filter((field) => field.status === 'same').length,
      conflictingFields: fields.filter((field) => field.status === 'conflict').length,
      targetOnlyFields: targetOnlyFields.length,
      entitiesToAdd: count('add'),
      sameEntities: count('same'),
      conflictingEntities: count('conflict'),
      ambiguousEntities: count('ambiguous'),
      targetOnlyEntities: targetOnlyEntities.length,
    },
  }
}

export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return Object.keys(value).length === 0
  return false
}

export function stableValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value instanceof Date) return `date:${value.toISOString()}`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`).join(',')}}`
}

export function cloneWorldPackValue<T>(value: T): T {
  return structuredClone(value)
}

function countEntityKeys(entities: readonly WorldPackEntitySnapshot[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entity of entities) {
    const key = entityKey(entity)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function entityKey(entity: Pick<WorldPackEntitySnapshot, 'category' | 'name'>): string {
  return `${entity.category.trim().toLowerCase()}\u0000${entity.name.trim().toLowerCase()}`
}

function entitySignature(
  entity: WorldPackEntitySnapshot,
  entitiesById: ReadonlyMap<string, WorldPackEntitySnapshot>,
): string {
  const parentName = entity.parentId ? (entitiesById.get(entity.parentId)?.name ?? null) : null
  const relations = entity.relations
    .map((relation) => ({
      targetName:
        entitiesById.get(relation.targetId)?.name.trim().toLowerCase() ??
        relation.targetName.trim().toLowerCase(),
      relationType: relation.relationType.trim().toLowerCase(),
      description: relation.description ?? '',
    }))
    .sort((a, b) => stableValue(a).localeCompare(stableValue(b)))
  return stableValue({
    name: entity.name.trim().toLowerCase(),
    category: entity.category.trim().toLowerCase(),
    aliases: [...entity.aliases].map((alias) => alias.trim().toLowerCase()).sort(),
    parentName: parentName?.trim().toLowerCase() ?? null,
    attributes: entity.attributes,
    relations,
    summary: entity.summary,
    detailMarkdown: entity.detailMarkdown ?? '',
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
