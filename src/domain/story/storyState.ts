import type { StoryConstraint } from './constraints'
import type { StoryEntity } from './entities'
import type { StoryEvent } from './events'
import type { NarrativePromise } from './promises'
import type { StoryRelation } from './relations'
import type { StoryScene } from './scenes'
import type { StoryTimeline } from './timelines'
import { assertProvenance } from './provenance'
import type { SourceEvidence } from './provenance'

export interface StoryState {
  revision: number
  entities: Record<string, StoryEntity>
  relations: Record<string, StoryRelation>
  events: Record<string, StoryEvent>
  scenes: Record<string, StoryScene>
  timelines: Record<string, StoryTimeline>
  promises: Record<string, NarrativePromise>
  constraints: Record<string, StoryConstraint>
}

const STORY_COLLECTIONS = [
  'entities',
  'relations',
  'events',
  'scenes',
  'timelines',
  'promises',
  'constraints',
] as const

export function createStoryState(revision = 0): StoryState {
  return {
    revision,
    entities: {},
    relations: {},
    events: {},
    scenes: {},
    timelines: {},
    promises: {},
    constraints: {},
  }
}

export function upsertEntity(state: StoryState, entity: StoryEntity): StoryState {
  return { ...state, entities: { ...state.entities, [entity.id]: entity } }
}

export function upsertRelation(state: StoryState, relation: StoryRelation): StoryState {
  return { ...state, relations: { ...state.relations, [relation.id]: relation } }
}

export function upsertEvent(state: StoryState, event: StoryEvent): StoryState {
  return { ...state, events: { ...state.events, [event.id]: event } }
}

export function upsertScene(state: StoryState, scene: StoryScene): StoryState {
  return { ...state, scenes: { ...state.scenes, [scene.id]: scene } }
}

export function upsertTimeline(state: StoryState, timeline: StoryTimeline): StoryState {
  return { ...state, timelines: { ...state.timelines, [timeline.id]: timeline } }
}

export function upsertPromise(state: StoryState, promise: NarrativePromise): StoryState {
  return { ...state, promises: { ...state.promises, [promise.id]: promise } }
}

export function upsertConstraint(state: StoryState, constraint: StoryConstraint): StoryState {
  return { ...state, constraints: { ...state.constraints, [constraint.id]: constraint } }
}

export function removeEntity(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'entities', id)
}

export function removeRelation(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'relations', id)
}

export function removeEvent(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'events', id)
}

export function removeScene(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'scenes', id)
}

export function removeTimeline(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'timelines', id)
}

export function removePromise(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'promises', id)
}

export function removeConstraint(state: StoryState, id: string): StoryState {
  return removeFromCollection(state, 'constraints', id)
}

function removeFromCollection(
  state: StoryState,
  collection: Exclude<keyof StoryState, 'revision'>,
  id: string,
): StoryState {
  const next = { ...state[collection] } as Record<string, unknown>
  delete next[id]
  return { ...state, [collection]: next }
}

export function withStoryRevision(state: StoryState, revision: number): StoryState {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new RangeError('Story revision must be a non-negative integer')
  }
  return { ...state, revision }
}

export function assertStoryState(state: StoryState): void {
  if (!isPlainRecord(state)) throw new Error('Story state must be an object')
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) {
    throw new Error('Story state has an invalid revision')
  }
  const allowedKeys = new Set<string>(['revision', ...STORY_COLLECTIONS])
  for (const key of Object.keys(state)) {
    if (!allowedKeys.has(key)) throw new Error(`Story state has an unknown field: ${key}`)
  }
  for (const collectionName of STORY_COLLECTIONS) {
    const collection = state[collectionName]
    if (!isPlainRecord(collection)) {
      throw new Error(`Story state is missing or has an invalid collection: ${collectionName}`)
    }
    for (const [id, value] of Object.entries(collection)) {
      assertStoryRecord(collectionName, id, value)
    }
  }
}

type StoryStateCollection = Exclude<keyof StoryState, 'revision'>

function assertStoryRecord(
  collectionName: StoryStateCollection,
  id: string,
  value: unknown,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value) || typeof value.id !== 'string' || value.id !== id || !id.trim()) {
    throw new Error(`Story ${collectionName} key does not match its entity id: ${id}`)
  }
  assertProvenance(value.provenance, `Story ${collectionName} entry ${id} invalid provenance`)

  switch (collectionName) {
    case 'entities':
      assertRequiredString(value.kind, `Story entity kind: ${id}`)
      assertRequiredString(value.name, `Story entity name: ${id}`)
      assertStringArray(value.aliases, `Story entity aliases: ${id}`)
      assertPlainObject(value.attributes, `Story entity attributes: ${id}`)
      assertOptionalString(value.status, `Story entity status: ${id}`)
      return
    case 'relations':
      assertRequiredString(value.sourceEntityId, `Story relation sourceEntityId: ${id}`)
      assertRequiredString(value.targetEntityId, `Story relation targetEntityId: ${id}`)
      assertRequiredString(value.type, `Story relation type: ${id}`)
      assertPlainObject(value.attributes, `Story relation attributes: ${id}`)
      return
    case 'events':
      assertRequiredString(value.type, `Story event type: ${id}`)
      assertOptionalString(value.title, `Story event title: ${id}`)
      assertOptionalString(value.sceneId, `Story event sceneId: ${id}`)
      assertTemporal(value.occurredAt, `Story event occurredAt: ${id}`)
      assertStringArray(value.entityIds, `Story event entityIds: ${id}`)
      assertPlainObject(value.attributes, `Story event attributes: ${id}`)
      return
    case 'scenes':
      assertOptionalString(value.title, `Story scene title: ${id}`)
      assertOptionalString(value.documentId, `Story scene documentId: ${id}`)
      assertStringArray(value.blockIds, `Story scene blockIds: ${id}`)
      assertStringArray(value.entityIds, `Story scene entityIds: ${id}`)
      assertStringArray(value.eventIds, `Story scene eventIds: ${id}`)
      assertOptionalNumber(value.order, `Story scene order: ${id}`)
      assertOptionalString(value.summary, `Story scene summary: ${id}`)
      return
    case 'timelines':
      assertRequiredString(value.label, `Story timeline label: ${id}`)
      assertStringArray(value.eventIds, `Story timeline eventIds: ${id}`)
      assertTimelineConstraints(value.constraints, `Story timeline constraints: ${id}`)
      return
    case 'promises':
      assertRequiredString(value.statement, `Story promise statement: ${id}`)
      if (
        value.status !== 'open' &&
        value.status !== 'fulfilled' &&
        value.status !== 'broken' &&
        value.status !== 'abandoned' &&
        value.status !== 'uncertain'
      ) {
        throw new Error(`Story promise has an invalid status: ${id}`)
      }
      assertTemporal(value.introducedAt, `Story promise introducedAt: ${id}`)
      assertTemporal(value.resolvedAt, `Story promise resolvedAt: ${id}`)
      assertEvidenceArray(value.evidence, `Story promise evidence: ${id}`)
      return
    case 'constraints':
      assertRequiredString(value.type, `Story constraint type: ${id}`)
      assertRequiredString(value.description, `Story constraint description: ${id}`)
      assertStringArray(value.subjectIds, `Story constraint subjectIds: ${id}`)
      if (value.severity !== 'info' && value.severity !== 'warning' && value.severity !== 'error') {
        throw new Error(`Story constraint has an invalid severity: ${id}`)
      }
      return
  }
}

function assertRequiredString(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context} must be a non-empty string`)
  }
}

function assertOptionalString(value: unknown, context: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${context} must be a string`)
  }
}

function assertStringArray(value: unknown, context: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${context} must be a string array`)
  }
}

function assertPlainObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw new Error(`${context} must be an object`)
}

function assertOptionalNumber(value: unknown, context: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${context} must be a finite number`)
  }
}

function assertTemporal(value: unknown, context: string): void {
  if (
    value !== undefined &&
    !(
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.trim() !== '')
    )
  ) {
    throw new Error(`${context} must be a finite number or non-empty string`)
  }
}

function assertTimelineConstraints(value: unknown, context: string): void {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`)
  value.forEach((item, index) => {
    const itemContext = `${context}[${index}]`
    if (!isPlainRecord(item)) throw new Error(`${itemContext} must be an object`)
    assertRequiredString(item.type, `${itemContext}.type`)
    assertRequiredString(item.description, `${itemContext}.description`)
    if (item.eventIds !== undefined) assertStringArray(item.eventIds, `${itemContext}.eventIds`)
  })
}

function assertEvidenceArray(value: unknown, context: string): asserts value is SourceEvidence[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`)
  value.forEach((item, index) => {
    const itemContext = `${context}[${index}]`
    if (!isPlainRecord(item)) throw new Error(`${itemContext} must be an object`)
    assertOptionalString(item.documentId, `${itemContext}.documentId`)
    assertOptionalString(item.blockId, `${itemContext}.blockId`)
    assertOptionalString(item.excerpt, `${itemContext}.excerpt`)
    const semanticFrom = item.semanticFrom
    if (
      semanticFrom !== undefined &&
      (typeof semanticFrom !== 'number' ||
        !Number.isSafeInteger(semanticFrom) ||
        semanticFrom < 0)
    ) {
      throw new Error(`${itemContext}.semanticFrom must be a non-negative integer`)
    }
    const semanticTo = item.semanticTo
    if (
      semanticTo !== undefined &&
      (typeof semanticTo !== 'number' ||
        !Number.isSafeInteger(semanticTo) ||
        semanticTo < 0)
    ) {
      throw new Error(`${itemContext}.semanticTo must be a non-negative integer`)
    }
    if (
      semanticFrom !== undefined &&
      semanticTo !== undefined &&
      semanticTo < semanticFrom
    ) {
      throw new Error(`${itemContext} has a reversed semantic range`)
    }
  })
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
