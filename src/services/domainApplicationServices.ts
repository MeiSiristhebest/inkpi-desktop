import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { TableRowRecord, CardRecord } from '../types'
import { db } from '../db/indexedDB'
import { storyStateMaterializer } from './storyStateMaterializer'
import { clock } from '../adapters/clock'
import { appendIndexedDbDomainChange } from '../adapters/indexedDbDomainChangeAppender'
import type { Provenance } from '../domain/story/provenance'

export type DomainWriteIntent =
  'author-confirmed' | 'ai-accepted' | 'ai-proposed' | 'demo' | 'imported-unknown'

function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    // SAFETY: mapping stripUndefined over each element preserves the element types of T,
    // only recursing into object/array values and dropping undefined leaf keys.
    return value.map(stripUndefined) as unknown as T
  }
  const record = value as Record<string, unknown>
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) {
      clean[k] = stripUndefined(v)
    }
  }
  return clean as T
}

export function createIntentProvenance(intent: DomainWriteIntent): Provenance {
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

export function resolveProvenance(
  existingProvenance: Provenance | undefined,
  intent: DomainWriteIntent,
): Provenance {
  if (intent === 'ai-accepted') {
    return {
      ...(existingProvenance ?? {}),
      sourceType: 'ai-extracted',
      factLevel: 'canonical-fact',
      evidence: existingProvenance?.evidence ? [...existingProvenance.evidence] : undefined,
      createdAt: existingProvenance?.createdAt ?? clock.now(),
    }
  }
  return createIntentProvenance(intent)
}

/**
 * Living Codex 领域应用服务
 */
export const codexApplicationService = {
  async saveEntity(entity: CodexEntity, intent: DomainWriteIntent): Promise<void> {
    const workspaceId = entity.projectId
    if (!workspaceId || !workspaceId.trim()) {
      throw new Error(
        `[codexApplicationService.saveEntity] Missing required workspaceId for entity ${entity.id}`,
      )
    }
    const existing = await db.get<CodexEntity>('codexEntities', entity.id)
    const existingProv = (entity as any).provenance ?? (existing as any)?.provenance
    const withProvenance: CodexEntity = {
      ...entity,
      updatedAt: clock.now(),
      provenance: resolveProvenance(existingProv, intent),
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

    await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
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
  async saveThread(thread: NarrativeThread, intent: DomainWriteIntent): Promise<void> {
    const workspaceId = thread.projectId
    if (!workspaceId || !workspaceId.trim()) {
      throw new Error(
        `[timelineApplicationService.saveThread] Missing required workspaceId for thread ${thread.id}`,
      )
    }
    const existing = await db.get<NarrativeThread>('narrativeThreads', thread.id)
    const existingProv = (thread as any).provenance ?? (existing as any)?.provenance
    const withProvenance: NarrativeThread = {
      ...thread,
      provenance: resolveProvenance(existingProv, intent),
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

    await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
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

  async saveNode(node: TimelineNode, intent: DomainWriteIntent): Promise<void> {
    const workspaceId = node.projectId
    if (!workspaceId || !workspaceId.trim()) {
      throw new Error(
        `[timelineApplicationService.saveNode] Missing required workspaceId for node ${node.id}`,
      )
    }
    const existing = await db.get<TimelineNode>('timelineNodes', node.id)
    const existingProv = (node as any).provenance ?? (existing as any)?.provenance
    const withProvenance: TimelineNode = {
      ...node,
      updatedAt: clock.now(),
      provenance: resolveProvenance(existingProv, intent),
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

    await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
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
  async savePromise(entry: PromiseLedgerEntry, intent: DomainWriteIntent): Promise<void> {
    const workspaceId = entry.projectId
    if (!workspaceId || !workspaceId.trim()) {
      throw new Error(
        `[promiseApplicationService.savePromise] Missing required workspaceId for promise ${entry.id}`,
      )
    }
    const existing = await db.get<PromiseLedgerEntry>('promiseLedger', entry.id)
    const existingProv = (entry as any).provenance ?? (existing as any)?.provenance
    const withProvenance: PromiseLedgerEntry = {
      ...entry,
      updatedAt: clock.now(),
      provenance: resolveProvenance(existingProv, intent),
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

    await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
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

/**
 * 旧版 Form / Table / Card 设定记录的领域应用服务。
 *
 * 让 42 模块时代的 Form/Table/Card 写入真正进入 Domain architecture：
 * durable IDB 写入 → append DomainChangeSet（workspace revision++）→ domainChangeEvents
 * → StoryStateMaterializer。这样 StoryStateProvider 的 materializeIfStale() 和
 * domainChangeEvents.subscribe() 才能在当前会话内感知设定变更，修复"实时刷新链断裂"
 * （此前这些记录直接 db.put()，workspace revision 不变、无 domain event，AI context 一直陈旧）。
 */
export const legacyDomainApplicationService = {
  /**
   * 保存一页设定表单。formData 以复合主键 `${projectId}::${tabId}` 存储。
   */
  async saveForm(projectId: string, tabId: string, data: Record<string, unknown>): Promise<void> {
    if (!projectId || !projectId.trim()) {
      throw new Error('[legacyDomainApplicationService.saveForm] Missing required projectId')
    }
    const id = `${projectId}::${tabId}`
    const existed = await db.get<unknown>('formData', id)
    const record = { id, projectId, tabId, data }
    await appendIndexedDbDomainChange({
      aggregateType: 'form',
      aggregateId: id,
      workspaceId: projectId,
      operation: 'upsert',
      payload: stripUndefined(record),
      occurredAt: clock.now(),
      aggregate: {
        store: 'formData',
        key: id,
        operation: 'upsert',
        value: record,
        expected: existed,
      },
    })
    await storyStateMaterializer.materialize(projectId).catch(() => undefined)
  },

  /**
   * 保存/新增设定台账行。
   */
  async saveTableRow(row: TableRowRecord): Promise<void> {
    const workspaceId = row.projectId
    const existed = await db.get<unknown>('tableRows', row.id)
    await appendIndexedDbDomainChange({
      aggregateType: 'table-row',
      aggregateId: row.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(row),
      occurredAt: clock.now(),
      aggregate: {
        store: 'tableRows',
        key: row.id,
        operation: 'upsert',
        value: row,
        expected: existed,
      },
    })
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  /**
   * 删除设定台账行。workspaceId 用于触发对应工作区的重物化。
   */
  async deleteTableRow(id: string, workspaceId?: string): Promise<void> {
    const existed = await db.get<unknown>('tableRows', id)
    await appendIndexedDbDomainChange({
      aggregateType: 'table-row',
      aggregateId: id,
      workspaceId: workspaceId || resolveWorkspaceOf('tableRows', id, existed),
      operation: 'delete',
      payload: undefined,
      occurredAt: clock.now(),
      aggregate: {
        store: 'tableRows',
        key: id,
        operation: 'delete',
        expected: existed,
      },
    })
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  /**
   * 保存/新增设定卡片。
   */
  async saveCard(card: CardRecord & { projectId: string; tabId: string }): Promise<void> {
    const workspaceId = card.projectId
    const existed = await db.get<unknown>('cardRecords', card.id)
    await appendIndexedDbDomainChange({
      aggregateType: 'card',
      aggregateId: card.id,
      workspaceId,
      operation: 'upsert',
      payload: stripUndefined(card),
      occurredAt: clock.now(),
      aggregate: {
        store: 'cardRecords',
        key: card.id,
        operation: 'upsert',
        value: card,
        expected: existed,
      },
    })
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  /**
   * 删除设定卡片。
   */
  async deleteCard(id: string, workspaceId?: string): Promise<void> {
    const existed = await db.get<unknown>('cardRecords', id)
    await appendIndexedDbDomainChange({
      aggregateType: 'card',
      aggregateId: id,
      workspaceId: workspaceId || resolveWorkspaceOf('cardRecords', id, existed),
      operation: 'delete',
      payload: undefined,
      occurredAt: clock.now(),
      aggregate: {
        store: 'cardRecords',
        key: id,
        operation: 'delete',
        expected: existed,
      },
    })
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}

function resolveWorkspaceOf(store: string, key: string, existing: unknown): string {
  const record = existing as { projectId?: string } | null
  if (record?.projectId) return record.projectId
  throw new Error(
    `[legacyDomainApplicationService] Cannot delete '${store}/${key}': missing workspaceId and no existing record to resolve it from`,
  )
}
