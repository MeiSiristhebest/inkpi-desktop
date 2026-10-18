import { db } from '../../db/indexedDB'
import type { SourceEvidence } from '../../domain/story/provenance'

export type DistillationItemStatus = 'pending' | 'accepted' | 'hypothesis' | 'merged' | 'rejected'

export interface DistillationItem {
  id: string
  workspaceId: string
  taskId: string
  category: 'entity' | 'event' | 'promise'
  name: string
  summary: string
  kind?: string
  attributes?: Record<string, unknown>
  confidence: number
  sourceDocumentId?: string
  sourceBlockId?: string
  sourceRevision?: number
  evidence?: SourceEvidence[]
  status: DistillationItemStatus
  createdAt: number
  resolvedAt?: number
  mergedIntoId?: string
}

interface SettingsKVRecord {
  key: string
  value: unknown
}

const KEY_PREFIX = 'distillation-review::'
const encodeKeyPart = (value: string): string => encodeURIComponent(value)

export const distillationReviewKey = (workspaceId: string, itemId: string): string =>
  `${KEY_PREFIX}${encodeKeyPart(workspaceId)}::${encodeKeyPart(itemId)}`

export class DistillationReviewStore {
  async save(item: DistillationItem): Promise<void> {
    await db.put<SettingsKVRecord>('settingsKV', {
      key: distillationReviewKey(item.workspaceId, item.id),
      value: item,
    })
  }

  async prepareResolution(item: DistillationItem) {
    if (item.status === 'pending') throw new Error('审查结果尚未确定。')
    const key = distillationReviewKey(item.workspaceId, item.id)
    const expected = await db.get<SettingsKVRecord>('settingsKV', key)
    const stored = expected?.value as DistillationItem | undefined
    if (
      stored?.status !== 'pending' ||
      stored.id !== item.id ||
      stored.workspaceId !== item.workspaceId
    ) {
      throw new Error('该候选已处理或未保存，请重新打开审查箱。')
    }
    return {
      store: 'settingsKV' as const,
      key,
      operation: 'upsert' as const,
      expected,
      value: { key, value: item },
    }
  }

  async resolve(item: DistillationItem): Promise<void> {
    const write = await this.prepareResolution(item)
    await db.runTransaction(['settingsKV'], (transaction, fail) => {
      const store = transaction.objectStore('settingsKV')
      const request = store.get(write.key)
      request.onerror = () => fail(request.error)
      request.onsuccess = () => {
        try {
          if (JSON.stringify(request.result) !== JSON.stringify(write.expected)) {
            throw new Error('该候选已更新或已处理，请重新打开审查箱。')
          }
          store.put(write.value)
        } catch (error) {
          fail(error)
        }
      }
    })
  }

  async get(workspaceId: string, itemId: string): Promise<DistillationItem | undefined> {
    const rec = await db.get<SettingsKVRecord>(
      'settingsKV',
      distillationReviewKey(workspaceId, itemId),
    )
    if (!rec || !rec.value) return undefined
    return rec.value as DistillationItem
  }

  async list(workspaceId: string): Promise<DistillationItem[]> {
    const prefix = `${KEY_PREFIX}${encodeKeyPart(workspaceId)}::`
    const records = await db.getAll<SettingsKVRecord>('settingsKV')
    return records
      .filter((r) => r.key.startsWith(prefix))
      .map((r) => r.value as DistillationItem)
      .filter((item): item is DistillationItem =>
        Boolean(item && item.workspaceId === workspaceId && item.id),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async listPending(workspaceId: string): Promise<DistillationItem[]> {
    const all = await this.list(workspaceId)
    return all.filter((item) => item.status === 'pending')
  }

  async remove(workspaceId: string, itemId: string): Promise<void> {
    await db.delete('settingsKV', distillationReviewKey(workspaceId, itemId))
  }

  async clear(workspaceId: string): Promise<void> {
    const items = await this.list(workspaceId)
    for (const it of items) {
      await this.remove(workspaceId, it.id)
    }
  }
}

export const distillationReviewStore = new DistillationReviewStore()
