import { assertProvenance, type Provenance } from '../domain/story/provenance'
import { storyStateMaterializer } from './storyStateMaterializer'
import {
  appendIndexedDbDomainChange,
  type AppendIndexedDbDomainChangeInput,
} from '../adapters/indexedDbDomainChangeAppender'
import { clock } from '../adapters/clock'
import { resolveProvenance, type DomainWriteIntent } from './domainApplicationServices'
import type { IndexedDbAggregateWrite } from '../adapters/indexedDbDomainChangeStore'

export interface AuthoritativePluginUpsertInput {
  aggregateType: string
  aggregateId: string
  workspaceId: string
  store: IndexedDbAggregateWrite['store']
  record: object
  existing?: unknown
  intent?: DomainWriteIntent
}

export async function appendAuthoritativePluginUpsert(
  input: AuthoritativePluginUpsertInput,
): Promise<Record<string, unknown>> {
  if (!input.workspaceId.trim()) {
    throw new Error(`Missing workspaceId for ${input.aggregateType}/${input.aggregateId}`)
  }

  if (!isRecord(input.record)) {
    throw new TypeError(
      `Plugin record must be an object: ${input.aggregateType}/${input.aggregateId}`,
    )
  }
  const existingProvenance = readProvenance(input.existing)
  const recordProvenance = readProvenance(input.record)
  const value = stripUndefined({
    ...input.record,
    updatedAt: input.record.updatedAt ?? clock.now(),
    provenance: resolveProvenance(
      recordProvenance ?? existingProvenance,
      input.intent ?? 'author-confirmed',
    ),
  })

  const appendInput: AppendIndexedDbDomainChangeInput = {
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    workspaceId: input.workspaceId,
    operation: 'upsert',
    payload: value,
    occurredAt: clock.now(),
    aggregate: {
      store: input.store,
      key: input.aggregateId,
      operation: 'upsert',
      value,
      expected: input.existing,
    },
  }
  await appendIndexedDbDomainChange(appendInput)
  await storyStateMaterializer.materialize(input.workspaceId).catch(() => undefined)
  return value
}

export async function appendAuthoritativePluginDelete(input: {
  aggregateType: string
  aggregateId: string
  workspaceId?: string
  store: IndexedDbAggregateWrite['store']
  existing?: unknown
}): Promise<void> {
  if (!input.existing) return
  const workspaceId = input.workspaceId ?? readWorkspaceId(input.existing)
  if (!workspaceId) {
    throw new Error(`Missing workspaceId for ${input.aggregateType}/${input.aggregateId}`)
  }

  await appendIndexedDbDomainChange({
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    workspaceId,
    operation: 'delete',
    payload: undefined,
    occurredAt: clock.now(),
    aggregate: {
      store: input.store,
      key: input.aggregateId,
      operation: 'delete',
      expected: input.existing,
    },
  })
  await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
}

function readProvenance(value: unknown): Provenance | undefined {
  if (!isRecord(value) || !isRecord(value.provenance)) return undefined
  assertProvenance(value.provenance, 'Authoritative plugin record provenance')
  return value.provenance
}

function readWorkspaceId(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.projectId !== 'string' || !value.projectId.trim()) {
    return undefined
  }
  return value.projectId
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    if (Array.isArray(item)) clean[key] = stripUndefinedArray(item)
    else if (isRecord(item)) clean[key] = stripUndefined(item)
    else clean[key] = item
  }
  return clean
}

function stripUndefinedArray(value: unknown[]): unknown[] {
  return value
    .filter((item) => item !== undefined)
    .map((item) =>
      Array.isArray(item)
        ? stripUndefinedArray(item)
        : isRecord(item)
          ? stripUndefined(item)
          : item,
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
