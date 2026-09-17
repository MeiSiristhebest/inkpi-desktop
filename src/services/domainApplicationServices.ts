import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import { db } from '../db/indexedDB'
import { storyStateMaterializer } from './storyStateMaterializer'
import { clock } from '../adapters/clock'
import { appendIndexedDbDomainChange } from '../adapters/indexedDbDomainChangeAppender'
import type { Provenance } from '../domain/story/provenance'

export type DomainWriteIntent =
  | 'author-confirmed'
  | 'ai-accepted'
  | 'ai-proposed'
  | 'demo'
  | 'imported-unknown'

function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T
  const record = value as Record<string, unknown>
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) {
      clean[k] = stripUndefined(v)
    }
  }
  return clean as T
}

export function createIntentProvenance(intent: DomainWriteIntent = 'author-confirmed'): Provenance {
  const now = clock.now()
  switch (intent) {
    case 'author-confirmed':
      return {
        sourceType: 'author',
        factLevel: 'canonical-fact',
        createdAt: now,
      }
    case 'ai-accepted':
      return {
        sourceType: 'ai-extracted',
        factLevel: 'canonical-fact',
        createdAt: now,
      }
    case 'ai-proposed':
      return {
        sourceType: 'ai-proposed',
        factLevel: 'proposal',
        createdAt: now,
      }
    case 'demo':
      return {
        sourceType: 'derived',
        factLevel: 'hypothesis',
        createdAt: now,
      }
    case 'imported-unknown':
    default:
      return {
        sourceType: 'derived',
        factLevel: 'hypothesis',
        createdAt: now,
      }
  }
}

/**
 * Living Codex 领域应用服务
 */
export const codexApplicationService = {
  async saveEntity(
    entity: CodexEntity,
    intent: DomainWriteIntent = 'author-confirmed',
  ): Promise<void> {
    const workspaceId = entity.projectId || 'default'
    const existing = await db.get<CodexEntity>('codexEntities', entity.id)
    const withProvenance: CodexEntity = {
      ...entity,
      updatedAt: clock.now(),
      provenance: (entity as any).provenance ?? createIntentProvenance(intent),
    } as any

    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'codex-entity',
      aggregateId: entity.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(withProvenance),
      occurredAt,
      aggregate: {
        store: 'codexEntities',
        key: entity.id,
        operation: 'upsert',
        value: withProvenance,
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async deleteEntity(id: string, workspaceId: string): Promise<void> {
    const existing = await db.get<CodexEntity>('codexEntities', id)
    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'codex-entity',
      aggregateId: id,
      workspaceId,
      operation: 'delete',
      payload: undefined,
      occurredAt,
      aggregate: {
        store: 'codexEntities',
        key: id,
        operation: 'delete',
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}

/**
 * Timeline Grid 领域应用服务
 */
export const timelineApplicationService = {
  async saveThread(
    thread: NarrativeThread,
    intent: DomainWriteIntent = 'author-confirmed',
  ): Promise<void> {
    const workspaceId = thread.projectId || 'default'
    const existing = await db.get<NarrativeThread>('narrativeThreads', thread.id)
    const withProvenance: NarrativeThread = {
      ...thread,
      provenance: (thread as any).provenance ?? createIntentProvenance(intent),
    } as any

    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'narrative-thread',
      aggregateId: thread.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(withProvenance),
      occurredAt,
      aggregate: {
        store: 'narrativeThreads',
        key: thread.id,
        operation: 'upsert',
        value: withProvenance,
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async deleteThread(id: string, workspaceId: string): Promise<void> {
    const existing = await db.get<NarrativeThread>('narrativeThreads', id)
    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'narrative-thread',
      aggregateId: id,
      workspaceId,
      operation: 'delete',
      payload: undefined,
      occurredAt,
      aggregate: {
        store: 'narrativeThreads',
        key: id,
        operation: 'delete',
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async saveNode(
    node: TimelineNode,
    intent: DomainWriteIntent = 'author-confirmed',
  ): Promise<void> {
    const workspaceId = node.projectId || 'default'
    const existing = await db.get<TimelineNode>('timelineNodes', node.id)
    const withProvenance: TimelineNode = {
      ...node,
      updatedAt: clock.now(),
      provenance: (node as any).provenance ?? createIntentProvenance(intent),
    } as any

    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'timeline-node',
      aggregateId: node.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(withProvenance),
      occurredAt,
      aggregate: {
        store: 'timelineNodes',
        key: node.id,
        operation: 'upsert',
        value: withProvenance,
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async deleteNode(id: string, workspaceId: string): Promise<void> {
    const existing = await db.get<TimelineNode>('timelineNodes', id)
    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'timeline-node',
      aggregateId: id,
      workspaceId,
      operation: 'delete',
      payload: undefined,
      occurredAt,
      aggregate: {
        store: 'timelineNodes',
        key: id,
        operation: 'delete',
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}

/**
 * Promise Ledger 领域应用服务
 */
export const promiseApplicationService = {
  async savePromise(
    entry: PromiseLedgerEntry,
    intent: DomainWriteIntent = 'author-confirmed',
  ): Promise<void> {
    const workspaceId = entry.projectId || 'default'
    const existing = await db.get<PromiseLedgerEntry>('promiseLedger', entry.id)
    const withProvenance: PromiseLedgerEntry = {
      ...entry,
      updatedAt: clock.now(),
      provenance: (entry as any).provenance ?? createIntentProvenance(intent),
    } as any

    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'promise-ledger',
      aggregateId: entry.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(withProvenance),
      occurredAt,
      aggregate: {
        store: 'promiseLedger',
        key: entry.id,
        operation: 'upsert',
        value: withProvenance,
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async deletePromise(id: string, workspaceId: string): Promise<void> {
    const existing = await db.get<PromiseLedgerEntry>('promiseLedger', id)
    const occurredAt = clock.now()
    await appendIndexedDbDomainChange({
      aggregateType: 'promise-ledger',
      aggregateId: id,
      workspaceId,
      operation: 'delete',
      payload: undefined,
      occurredAt,
      aggregate: {
        store: 'promiseLedger',
        key: id,
        operation: 'delete',
        expected: existing,
      },
    })

    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}
