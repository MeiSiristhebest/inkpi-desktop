import {
  calculateDomainChangeSetChecksum,
  type DomainChange,
  type DomainChangeSet,
} from '@inkpi/protocol'

export interface CreateDomainChangeSetInput {
  id: string
  workspaceId: string
  sourceDeviceId: string
  baseRevision: number
  changes: DomainChange[]
  createdAt: number
}

export function createDomainChangeSet(input: CreateDomainChangeSetInput): DomainChangeSet {
  assertNonNegativeRevision(input.baseRevision, 'Domain change base revision')
  const unsigned = {
    id: input.id,
    workspaceId: input.workspaceId,
    sourceDeviceId: input.sourceDeviceId,
    baseRevision: input.baseRevision,
    revision: input.baseRevision + 1,
    changes: input.changes.map(cloneDomainChange),
    createdAt: input.createdAt,
  }
  const changeSet = { ...unsigned, checksum: calculateDomainChangeSetChecksum(unsigned) }
  assertDomainChangeSet(changeSet)
  return cloneDomainChangeSet(changeSet)
}

/** Validates the complete JSON-safe contract before local persistence or RPC. */
export function assertDomainChangeSet(value: unknown): asserts value is DomainChangeSet {
  if (!isRecord(value)) throw new Error('Domain change set must be an object')
  assertNonEmptyString(value.id, 'Domain change set id')
  assertNonEmptyString(value.workspaceId, 'Domain change set workspace id')
  assertNonEmptyString(value.sourceDeviceId, 'Domain change set source device id')
  assertNonNegativeRevision(value.baseRevision, 'Domain change set base revision')
  assertNonNegativeRevision(value.revision, 'Domain change set revision')
  if (value.revision !== value.baseRevision + 1) {
    throw new Error('Domain change set revisions are invalid')
  }
  assertTimestamp(value.createdAt, 'Domain change set createdAt')
  if (!Array.isArray(value.changes)) throw new Error('Domain change set changes must be an array')
  if (typeof value.checksum !== 'string' || !value.checksum.trim()) {
    throw new Error('Domain change set checksum must not be empty')
  }

  const changeIds = new Set<string>()
  for (const [index, change] of value.changes.entries()) {
    assertDomainChange(change, index)
    if (changeIds.has(change.id)) {
      throw new Error(`Domain change set contains duplicate change id: ${change.id}`)
    }
    changeIds.add(change.id)
  }

  const { checksum: _checksum, ...unsigned } = value
  if (
    calculateDomainChangeSetChecksum(unsigned as Omit<DomainChangeSet, 'checksum'>) !==
    value.checksum
  ) {
    throw new Error(`Corrupt domain change set checksum: ${value.id}`)
  }
}

/** Alias used by adapters that prefer a validation verb. */
export const validateDomainChangeSet = assertDomainChangeSet

/** Returns a detached change set so IndexedDB/RPC callers cannot mutate the log. */
export function cloneDomainChangeSet(changeSet: DomainChangeSet): DomainChangeSet {
  assertDomainChangeSet(changeSet)
  return {
    ...changeSet,
    changes: changeSet.changes.map(cloneDomainChange),
  }
}

function assertDomainChange(value: unknown, index: number): asserts value is DomainChange {
  if (!isRecord(value)) throw new Error(`Domain change at index ${index} must be an object`)
  assertNonEmptyString(value.id, `Domain change id at index ${index}`)
  assertNonEmptyString(value.aggregateType, `Domain change aggregate type at index ${index}`)
  assertNonEmptyString(value.aggregateId, `Domain change aggregate id at index ${index}`)
  if (value.operation !== 'upsert' && value.operation !== 'delete') {
    throw new Error(`Domain change operation at index ${index} is invalid`)
  }
  assertNonNegativeRevision(value.revision, `Domain change revision at index ${index}`)
  assertTimestamp(value.occurredAt, `Domain change occurredAt at index ${index}`)
  if (value.payload !== undefined) assertJsonValue(value.payload, `changes[${index}].payload`)
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must not be empty`)
}

function assertNonNegativeRevision(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
}

function assertTimestamp(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`)
  }
}

function assertJsonValue(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain finite numbers`)
    return
  }
  if (typeof value !== 'object') throw new Error(`${path} contains an unsupported value`)
  if (seen.has(value)) throw new Error(`${path} contains a cyclic value`)
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item === undefined) throw new Error(`${path}[${index}] is undefined`)
        assertJsonValue(item, `${path}[${index}]`, seen)
      })
      return
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains an unsupported object type`)
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) throw new Error(`${path}.${key} is undefined`)
      assertJsonValue(item, `${path}.${key}`, seen)
    }
  } finally {
    seen.delete(value)
  }
}

function cloneDomainChange(change: DomainChange): DomainChange {
  return {
    ...change,
    ...(change.payload === undefined ? {} : { payload: cloneJsonValue(change.payload) }),
  }
}

function cloneJsonValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item)) as T
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = cloneJsonValue(item)
  }
  return result as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
