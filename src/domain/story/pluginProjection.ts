import type { StoryEntity } from './entities'
import type { StoryEvent } from './events'
import type { NarrativePromise, NarrativePromiseStatus } from './promises'
import type { Provenance, ProvenanceSourceType, SourceEvidence, StoryFactLevel } from './provenance'
import type { StoryState } from './storyState'
import type { StoryTimeline, TimelineConstraint } from './timelines'
import { assertStoryState, createStoryState } from './storyState'

/** Collections owned by the canonical StoryState read model. */
export type StoryStateCollection = Exclude<keyof StoryState, 'revision'>

/** Plugin ids that currently have an explicit local StoryState projection route. */
export type StoryPluginSourceId = 'living-codex' | 'timeline-grid' | 'promise-ledger'

/**
 * Explicit source-plugin collection to canonical StoryState collection mapping.
 *
 * `timeline-grid` has two different domain records: a thread is a timeline and
 * a node is a story event. The aliases are intentional and cover the singular
 * and plural names used by plugin-facing callers; unknown names are rejected.
 */
export const STORY_PLUGIN_COLLECTION_MAP = {
  'living-codex': {
    entity: 'entities',
    entities: 'entities',
  },
  'timeline-grid': {
    thread: 'timelines',
    threads: 'timelines',
    timeline: 'timelines',
    timelines: 'timelines',
    node: 'events',
    nodes: 'events',
    event: 'events',
    events: 'events',
  },
  'promise-ledger': {
    entry: 'promises',
    entries: 'promises',
    promise: 'promises',
    promises: 'promises',
  },
} as const satisfies Record<StoryPluginSourceId, Readonly<Record<string, StoryStateCollection>>>

export interface StoryPluginCollectionInput {
  /** The stable plugin/source id, not a display name. */
  sourceId: string
  /** The source collection name declared in STORY_PLUGIN_COLLECTION_MAP. */
  collection: string
  /** Raw plugin records. Each record must carry its own canonical provenance. */
  records: readonly unknown[]
}

export interface StoryPluginProjectionOptions {
  /** Semantic StoryState revision for this complete local projection. */
  revision?: number
}

type CanonicalStoryRecord = StoryEntity | StoryEvent | StoryTimeline | NarrativePromise

interface ProjectionRoute {
  targetCollection: StoryStateCollection
  project: (record: Record<string, unknown>, provenance: Provenance) => CanonicalStoryRecord
}

type ProjectionRoutes = Readonly<Record<string, Readonly<Record<string, ProjectionRoute>>>>

const PROJECTION_ROUTES: ProjectionRoutes = {
  'living-codex': {
    entity: { targetCollection: 'entities', project: projectCodexEntity },
    entities: { targetCollection: 'entities', project: projectCodexEntity },
  },
  'timeline-grid': {
    thread: { targetCollection: 'timelines', project: projectTimelineThread },
    threads: { targetCollection: 'timelines', project: projectTimelineThread },
    timeline: { targetCollection: 'timelines', project: projectCanonicalTimeline },
    timelines: { targetCollection: 'timelines', project: projectCanonicalTimeline },
    node: { targetCollection: 'events', project: projectTimelineNode },
    nodes: { targetCollection: 'events', project: projectTimelineNode },
    event: { targetCollection: 'events', project: projectTimelineNode },
    events: { targetCollection: 'events', project: projectTimelineNode },
  },
  'promise-ledger': {
    entry: { targetCollection: 'promises', project: projectPromiseLedgerEntry },
    entries: { targetCollection: 'promises', project: projectPromiseLedgerEntry },
    promise: { targetCollection: 'promises', project: projectPromiseLedgerEntry },
    promises: { targetCollection: 'promises', project: projectPromiseLedgerEntry },
  },
}

/**
 * Projects plugin-owned records into a complete canonical StoryState.
 *
 * This is deliberately a pure boundary: it accepts data, performs no
 * repository reads and never invokes a plugin or an AI task. Records are
 * sorted by id before materialization so equivalent input ordering produces
 * the same result. Duplicate ids are rejected across all target collections.
 */
export function projectPluginRecordsToStoryState(
  sources: readonly StoryPluginCollectionInput[],
  options: StoryPluginProjectionOptions = {},
): StoryState {
  if (!Array.isArray(sources)) {
    throw new TypeError('StoryState plugin projection sources must be an array')
  }

  const revision = options.revision ?? 0
  assertRevision(revision)

  const recordsByCollection: Record<StoryStateCollection, Map<string, CanonicalStoryRecord>> = {
    entities: new Map(),
    relations: new Map(),
    events: new Map(),
    scenes: new Map(),
    timelines: new Map(),
    promises: new Map(),
    constraints: new Map(),
  }
  const seenIds = new Set<string>()

  for (const [sourceIndex, source] of sources.entries()) {
    if (!isRecord(source)) {
      throw new TypeError(`StoryState plugin projection source ${sourceIndex} must be an object`)
    }
    const sourceId = requiredStringValue(source.sourceId, 'source id', `source ${sourceIndex}`)
    const collection = requiredStringValue(source.collection, 'collection', `source ${sourceIndex}`)
    const route = PROJECTION_ROUTES[sourceId]?.[collection]
    if (!route) {
      if (!PROJECTION_ROUTES[sourceId]) {
        throw new Error(`Unknown StoryState plugin source id "${sourceId}"`)
      }
      throw new Error(
        `Unknown StoryState plugin collection "${collection}" for source "${sourceId}"`,
      )
    }
    if (!Array.isArray(source.records)) {
      throw new TypeError(
        `StoryState plugin collection records must be an array: ${sourceId}/${collection}`,
      )
    }

    for (const [recordIndex, rawRecord] of source.records.entries()) {
      const record = requireRecord(rawRecord, `${sourceId}/${collection}[${recordIndex}]`)
      const id = requiredStringValue(record.id, 'id', `${sourceId}/${collection}[${recordIndex}]`)
      if (seenIds.has(id)) {
        throw new Error(`Duplicate StoryState plugin record id "${id}"`)
      }
      const provenance = requireProvenance(
        record.provenance,
        `${sourceId}/${collection}[${recordIndex}]`,
      )
      const projected = route.project(record, provenance)
      if (projected.id !== id) {
        throw new Error(`Projected StoryState record id mismatch: ${sourceId}/${collection}/${id}`)
      }
      seenIds.add(id)
      recordsByCollection[route.targetCollection].set(id, projected)
    }
  }

  const state = createStoryState(revision)
  for (const collection of Object.keys(recordsByCollection) as StoryStateCollection[]) {
    const materialized = Object.fromEntries(
      [...recordsByCollection[collection].entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([id, record]) => [id, clone(record)]),
    ) as Record<string, CanonicalStoryRecord>
    assignCollection(state, collection, materialized)
  }

  assertStoryState(state)
  return state
}

function projectCodexEntity(record: Record<string, unknown>, provenance: Provenance): StoryEntity {
  const id = requiredStringValue(record.id, 'id', 'living-codex/entity')
  const kind = requiredStringValue(
    record.category ?? record.kind,
    'category',
    `living-codex/entity/${id}`,
  )
  const name = requiredStringValue(record.name, 'name', `living-codex/entity/${id}`)
  const aliases = stringArray(record.aliases, `living-codex/entity/${id}`, 'aliases')
  const attributes = objectValue(record.attributes, `living-codex/entity/${id}`, 'attributes')
  const status = optionalString(record.status, `living-codex/entity/${id}`, 'status')

  return {
    id,
    kind,
    name,
    aliases: sortStrings(aliases ?? []),
    attributes: cloneObject(attributes ?? {}),
    ...(status === undefined ? {} : { status }),
    provenance: clone(provenance),
  }
}

function projectTimelineThread(
  record: Record<string, unknown>,
  provenance: Provenance,
): StoryTimeline {
  const id = requiredStringValue(record.id, 'id', 'timeline-grid/thread')
  const label = requiredStringValue(
    record.name ?? record.label,
    'name or label',
    `timeline-grid/thread/${id}`,
  )
  return {
    id,
    label,
    eventIds: sortStrings(
      stringArray(record.eventIds ?? record.nodeIds, `timeline-grid/thread/${id}`, 'eventIds') ??
        [],
    ),
    constraints: timelineConstraints(record.constraints, `timeline-grid/thread/${id}`),
    provenance: clone(provenance),
  }
}

function projectCanonicalTimeline(
  record: Record<string, unknown>,
  provenance: Provenance,
): StoryTimeline {
  const id = requiredStringValue(record.id, 'id', 'timeline-grid/timeline')
  const label = requiredStringValue(record.label ?? record.name, 'label or name', id)
  return {
    id,
    label,
    eventIds: sortStrings(
      stringArray(record.eventIds, `timeline-grid/timeline/${id}`, 'eventIds') ?? [],
    ),
    constraints: timelineConstraints(record.constraints, `timeline-grid/timeline/${id}`),
    provenance: clone(provenance),
  }
}

function projectTimelineNode(record: Record<string, unknown>, provenance: Provenance): StoryEvent {
  const id = requiredStringValue(record.id, 'id', 'timeline-grid/node')
  const title = requiredStringValue(
    record.eventTitle ?? record.title ?? record.name,
    'eventTitle, title, or name',
    `timeline-grid/node/${id}`,
  )
  const occurredAt = temporalValue(
    record.chapterOrder ?? record.occurredAt,
    `timeline-grid/node/${id}`,
    'chapterOrder or occurredAt',
  )
  const entityIds = sortStrings(
    stringArray(
      record.relatedEntityIds ?? record.entityIds,
      `timeline-grid/node/${id}`,
      'relatedEntityIds',
    ) ?? [],
  )

  const attributes = objectValue(record.attributes, `timeline-grid/node/${id}`, 'attributes') ?? {}
  const pluginFields = [
    'causalOutcome',
    'chapterOrder',
    'createdAt',
    'emotionalPolarity',
    'nextEventIds',
    'prerequisites',
    'projectId',
    'status',
    'summary',
    'threadId',
    'updatedAt',
  ]
  const mergedAttributes: Record<string, unknown> = { ...cloneObject(attributes) }
  for (const field of pluginFields) {
    if (record[field] !== undefined && mergedAttributes[field] === undefined) {
      mergedAttributes[field] = clone(record[field])
    }
  }

  return {
    id,
    type: 'timeline-node',
    title,
    ...(occurredAt === undefined ? {} : { occurredAt }),
    entityIds,
    attributes: cloneObject(mergedAttributes),
    provenance: clone(provenance),
  }
}

const PROMISE_STATUS_MAP: Readonly<Record<string, NarrativePromiseStatus>> = {
  planted: 'open',
  progressing: 'open',
  paid_off: 'fulfilled',
  abandoned: 'abandoned',
  open: 'open',
  fulfilled: 'fulfilled',
  broken: 'broken',
  uncertain: 'uncertain',
}

function projectPromiseLedgerEntry(
  record: Record<string, unknown>,
  provenance: Provenance,
): NarrativePromise {
  const id = requiredStringValue(record.id, 'id', 'promise-ledger/entry')
  const statement = requiredStringValue(
    record.statement ?? record.plantNote ?? record.clueName,
    'statement, plantNote, or clueName',
    `promise-ledger/entry/${id}`,
  )
  const sourceStatus = requiredStringValue(record.status, 'status', `promise-ledger/entry/${id}`)
  const status = PROMISE_STATUS_MAP[sourceStatus]
  if (!status) {
    throw new Error(`Invalid promise status "${sourceStatus}": promise-ledger/entry/${id}`)
  }

  const introducedAt = temporalValue(
    record.introducedAt ?? record.plantChapter,
    `promise-ledger/entry/${id}`,
    'introducedAt or plantChapter',
  )
  const resolvedAt = temporalValue(
    record.resolvedAt ?? record.payoffChapter,
    `promise-ledger/entry/${id}`,
    'resolvedAt or payoffChapter',
  )
  const evidence = sourceEvidence(record.evidence, `promise-ledger/entry/${id}`)
  return {
    id,
    statement,
    status,
    ...(introducedAt === undefined ? {} : { introducedAt }),
    ...(resolvedAt === undefined ? {} : { resolvedAt }),
    evidence,
    provenance: clone(provenance),
  }
}

function requireProvenance(value: unknown, context: string): Provenance {
  if (!isRecord(value)) {
    throw new Error(`Missing provenance: ${context}`)
  }
  if (!isProvenanceSourceType(value.sourceType)) {
    throw new Error(`Invalid provenance sourceType: ${context}`)
  }
  if (!isStoryFactLevel(value.factLevel)) {
    throw new Error(`Invalid provenance factLevel: ${context}`)
  }
  return cloneObject(value) as unknown as Provenance
}

function isProvenanceSourceType(value: unknown): value is ProvenanceSourceType {
  return (
    value === 'author' ||
    value === 'editor' ||
    value === 'ai-extracted' ||
    value === 'ai-proposed' ||
    value === 'derived'
  )
}

function isStoryFactLevel(value: unknown): value is StoryFactLevel {
  return (
    value === 'canonical-fact' ||
    value === 'character-belief' ||
    value === 'rumor' ||
    value === 'hypothesis' ||
    value === 'ai-inference' ||
    value === 'proposal'
  )
}

function timelineConstraints(value: unknown, context: string): TimelineConstraint[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new TypeError(`Timeline constraints must be an array: ${context}`)
  }
  const constraints = value.map((item, index) => {
    const constraint = requireRecord(item, `${context}/constraints[${index}]`)
    const type = requiredStringValue(constraint.type, 'type', `${context}/constraints[${index}]`)
    const description = requiredStringValue(
      constraint.description,
      'description',
      `${context}/constraints[${index}]`,
    )
    const eventIds = stringArray(
      constraint.eventIds,
      `${context}/constraints[${index}]`,
      'eventIds',
    )
    return {
      type,
      description,
      ...(eventIds === undefined ? {} : { eventIds: sortStrings(eventIds) }),
    }
  })
  return constraints.sort((left, right) =>
    compareStrings(
      `${left.type}\u0000${left.description}\u0000${left.eventIds?.join('\u0000') ?? ''}`,
      `${right.type}\u0000${right.description}\u0000${right.eventIds?.join('\u0000') ?? ''}`,
    ),
  )
}

function sourceEvidence(value: unknown, context: string): SourceEvidence[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new TypeError(`Promise evidence must be an array: ${context}`)
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new TypeError(`Promise evidence item must be an object: ${context}/evidence[${index}]`)
    }
    return cloneObject(item) as SourceEvidence
  })
}

function requiredStringValue(value: unknown, field: string, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing or invalid ${field}: ${context}`)
  }
  return value
}

function optionalString(value: unknown, context: string, field: string): string | undefined {
  if (value === undefined) return undefined
  return requiredStringValue(value, field, context)
}

function stringArray(value: unknown, context: string, field: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(`Invalid ${field}; expected string array: ${context}`)
  }
  return [...value]
}

function objectValue(
  value: unknown,
  context: string,
  field: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new TypeError(`Invalid ${field}; expected object: ${context}`)
  }
  return value
}

function temporalValue(
  value: unknown,
  context: string,
  field: string,
): string | number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
  }
  if (typeof value === 'string' && value.trim() !== '') return value
  throw new TypeError(`Invalid ${field}; expected finite number or non-empty string: ${context}`)
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`Plugin record must be an object: ${context}`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertRevision(revision: number): asserts revision is number {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new RangeError('StoryState plugin projection revision must be a non-negative integer')
  }
}

function assignCollection(
  state: StoryState,
  collection: StoryStateCollection,
  records: Record<string, CanonicalStoryRecord>,
): void {
  switch (collection) {
    case 'entities':
      state.entities = records as Record<string, StoryEntity>
      break
    case 'relations':
      state.relations = records as unknown as StoryState['relations']
      break
    case 'events':
      state.events = records as Record<string, StoryEvent>
      break
    case 'scenes':
      state.scenes = records as unknown as StoryState['scenes']
      break
    case 'timelines':
      state.timelines = records as Record<string, StoryTimeline>
      break
    case 'promises':
      state.promises = records as Record<string, NarrativePromise>
      break
    case 'constraints':
      state.constraints = records as unknown as StoryState['constraints']
      break
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function cloneObject(value: Record<string, unknown>): Record<string, unknown> {
  const copied = clone(value)
  return Object.fromEntries(
    Object.keys(copied)
      .sort(compareStrings)
      .map((key) => [key, copied[key]]),
  )
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort(compareStrings)
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}
