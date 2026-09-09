import {
  calculateDomainChangeSetChecksum,
  type DomainChange,
  type DomainChangeSet,
} from '@inkpi/protocol'
import type { StoryState } from './storyState'
import { assertStoryState, createStoryState, withStoryRevision } from './storyState'

export interface StoryStateProjection {
  /** DomainChangeSet cursor; separate from StoryState's semantic revision. */
  domainRevision: number
  state: StoryState
}

/**
 * Applies authoritative domain changes to the typed StoryState read model.
 * Document, project, and other non-story aggregates are intentionally ignored;
 * their own reducers remain separate while the shared domain cursor advances.
 */
export function reduceStoryStateProjection(
  current: StoryStateProjection,
  changeSet: DomainChangeSet,
): StoryStateProjection {
  assertProjection(current)
  assertChangeSet(changeSet)
  if (changeSet.baseRevision !== current.domainRevision) {
    throw new Error(
      `StoryState projection revision conflict: expected base ${current.domainRevision}, received ${changeSet.baseRevision}`,
    )
  }

  let nextState = structuredClone(current.state)
  let storyChanged = false
  let nextSemanticRevision = nextState.revision

  for (const change of changeSet.changes) {
    const collection = collectionForAggregate(change.aggregateType)
    if (collection) {
      storyChanged = true
      if (change.operation === 'delete') {
        nextState = removeRecord(nextState, collection, change.aggregateId)
      } else {
        nextState = upsertRecord(nextState, collection, change)
      }
      if (Number.isInteger(change.revision) && change.revision >= 0) {
        nextSemanticRevision = Math.max(nextSemanticRevision, change.revision)
      }
      continue
    }

    if (isFullStoryStateAggregate(change.aggregateType)) {
      storyChanged = true
      if (change.operation === 'delete') {
        nextState = createStoryState(nextState.revision + 1)
      } else {
        nextState = fullStoryState(change)
        nextSemanticRevision = nextState.revision
      }
    }
  }

  if (storyChanged && nextState.revision <= nextSemanticRevision) {
    nextState = withStoryRevision(nextState, Math.max(nextState.revision, nextSemanticRevision))
  }

  assertStoryState(nextState)
  return {
    domainRevision: changeSet.revision,
    state: nextState,
  }
}

export function replayStoryStateProjection(
  changeSets: readonly DomainChangeSet[],
  initial: StoryStateProjection = { domainRevision: 0, state: createStoryState() },
): StoryStateProjection {
  return changeSets.reduce(reduceStoryStateProjection, initial)
}

function upsertRecord(
  state: StoryState,
  collection: StoryCollection,
  change: DomainChange,
): StoryState {
  const payload = recordPayload(change)
  return {
    ...state,
    [collection]: {
      ...state[collection],
      [change.aggregateId]: payload,
    },
  } as StoryState
}

function removeRecord(state: StoryState, collection: StoryCollection, id: string): StoryState {
  const records = { ...state[collection] } as Record<string, unknown>
  delete records[id]
  return { ...state, [collection]: records } as StoryState
}

function fullStoryState(change: DomainChange): StoryState {
  if (!isRecord(change.payload)) {
    throw new Error(`StoryState snapshot payload must be an object: ${change.aggregateId}`)
  }
  const payload = structuredClone(change.payload) as StoryState
  for (const collection of STORY_COLLECTIONS) {
    if (!isRecord(payload[collection])) {
      throw new Error(`StoryState snapshot is missing ${collection}: ${change.aggregateId}`)
    }
  }
  assertStoryState(payload)
  return payload
}

function recordPayload(change: DomainChange): Record<string, unknown> {
  if (!isRecord(change.payload)) {
    throw new Error(`Story ${change.aggregateType} payload must be an object: ${change.aggregateId}`)
  }
  const payload = structuredClone(change.payload)
  if (payload.id !== change.aggregateId) {
    throw new Error(`Story ${change.aggregateType} payload id mismatch: ${change.aggregateId}`)
  }
  if (!isRecord(payload.provenance)) {
    throw new Error(`Story ${change.aggregateType} payload is missing provenance: ${change.aggregateId}`)
  }
  if (typeof payload.provenance.sourceType !== 'string' || typeof payload.provenance.factLevel !== 'string') {
    throw new Error(`Story ${change.aggregateType} payload has invalid provenance: ${change.aggregateId}`)
  }
  return payload
}

type StoryCollection = Exclude<keyof StoryState, 'revision'>

const STORY_COLLECTIONS: StoryCollection[] = [
  'entities',
  'relations',
  'events',
  'scenes',
  'timelines',
  'promises',
  'constraints',
]

function collectionForAggregate(aggregateType: string): StoryCollection | undefined {
  const normalized = aggregateType.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  switch (normalized) {
    case 'entity':
    case 'entities':
    case 'storyentity':
    case 'storyentities':
    case 'character':
    case 'characters':
      return 'entities'
    case 'relation':
    case 'relations':
    case 'storyrelation':
    case 'storyrelations':
      return 'relations'
    case 'event':
    case 'events':
    case 'storyevent':
    case 'storyevents':
    case 'narrativeevent':
      return 'events'
    case 'scene':
    case 'scenes':
    case 'storyscene':
    case 'storyscenes':
      return 'scenes'
    case 'timeline':
    case 'timelines':
    case 'storytimeline':
    case 'storytimelines':
      return 'timelines'
    case 'promise':
    case 'promises':
    case 'storypromise':
    case 'storypromises':
    case 'narrativepromise':
      return 'promises'
    case 'constraint':
    case 'constraints':
    case 'storyconstraint':
    case 'storyconstraints':
      return 'constraints'
    default:
      return undefined
  }
}

function isFullStoryStateAggregate(aggregateType: string): boolean {
  const normalized = aggregateType.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === 'story' || normalized === 'storystate' || normalized === 'storystatesnapshot'
}

function assertProjection(projection: StoryStateProjection): void {
  if (!projection || !Number.isInteger(projection.domainRevision) || projection.domainRevision < 0) {
    throw new Error('StoryState projection has an invalid domain revision')
  }
  assertStoryState(projection.state)
}

function assertChangeSet(changeSet: DomainChangeSet): void {
  if (
    !changeSet.id.trim() ||
    !changeSet.workspaceId.trim() ||
    !changeSet.sourceDeviceId.trim() ||
    !Number.isInteger(changeSet.baseRevision) ||
    changeSet.baseRevision < 0 ||
    !Number.isInteger(changeSet.revision) ||
    changeSet.revision !== changeSet.baseRevision + 1 ||
    !Array.isArray(changeSet.changes)
  ) {
    throw new Error('StoryState DomainChangeSet has invalid revision or identifiers')
  }
  const { checksum: _checksum, ...unsigned } = changeSet
  if (calculateDomainChangeSetChecksum(unsigned) !== changeSet.checksum) {
    throw new Error(`StoryState DomainChangeSet checksum mismatch: ${changeSet.id}`)
  }
  for (const change of changeSet.changes) {
    if (
      !change.id.trim() ||
      !change.aggregateType.trim() ||
      !change.aggregateId.trim() ||
      !Number.isInteger(change.revision) ||
      change.revision < 0 ||
      !Number.isFinite(change.occurredAt)
    ) {
      throw new Error(`StoryState DomainChange has invalid coordinates: ${changeSet.id}`)
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
