import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import { indexedDbCodexEntityRepository } from '../adapters/indexedDbCodexEntityRepository'
import { indexedDbTimelineRepository } from '../adapters/indexedDbTimelineRepository'
import { indexedDbPromiseLedgerRepository } from '../adapters/indexedDbPromiseLedgerRepository'
import { storyStateMaterializer } from './storyStateMaterializer'
import { clock } from '../adapters/clock'

/**
 * 作者事实级标准溯源信息构造（仅当经过 Application Service 显式确认/保存时生成）
 */
function createAuthorProvenance() {
  return {
    sourceType: 'author' as const,
    factLevel: 'canonical-fact' as const,
    createdAt: clock.now(),
  }
}

/**
 * Living Codex 领域应用服务
 */
export const codexApplicationService = {
  async saveEntity(entity: CodexEntity): Promise<void> {
    const withProvenance: CodexEntity = {
      ...entity,
      updatedAt: clock.now(),
      provenance: (entity as any).provenance ?? createAuthorProvenance(),
    } as any

    await indexedDbCodexEntityRepository.save(withProvenance)
    if (entity.projectId) {
      await storyStateMaterializer.materialize(entity.projectId).catch(() => undefined)
    }
  },

  async deleteEntity(id: string, workspaceId: string): Promise<void> {
    await indexedDbCodexEntityRepository.delete(id)
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}

/**
 * Timeline Grid 领域应用服务
 */
export const timelineApplicationService = {
  async saveThread(thread: NarrativeThread): Promise<void> {
    const withProvenance: NarrativeThread = {
      ...thread,
      provenance: (thread as any).provenance ?? createAuthorProvenance(),
    } as any
    await indexedDbTimelineRepository.saveThread(withProvenance)
    if (thread.projectId) {
      await storyStateMaterializer.materialize(thread.projectId).catch(() => undefined)
    }
  },

  async deleteThread(id: string, workspaceId: string): Promise<void> {
    await indexedDbTimelineRepository.deleteThread(id)
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },

  async saveNode(node: TimelineNode): Promise<void> {
    const withProvenance: TimelineNode = {
      ...node,
      updatedAt: clock.now(),
      provenance: (node as any).provenance ?? createAuthorProvenance(),
    } as any
    await indexedDbTimelineRepository.saveNode(withProvenance)
    if (node.projectId) {
      await storyStateMaterializer.materialize(node.projectId).catch(() => undefined)
    }
  },

  async deleteNode(id: string, workspaceId: string): Promise<void> {
    await indexedDbTimelineRepository.deleteNode(id)
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}

/**
 * Promise Ledger 领域应用服务
 */
export const promiseApplicationService = {
  async savePromise(entry: PromiseLedgerEntry): Promise<void> {
    const withProvenance: PromiseLedgerEntry = {
      ...entry,
      updatedAt: clock.now(),
      provenance: (entry as any).provenance ?? createAuthorProvenance(),
    } as any
    await indexedDbPromiseLedgerRepository.save(withProvenance)
    if (entry.projectId) {
      await storyStateMaterializer.materialize(entry.projectId).catch(() => undefined)
    }
  },

  async deletePromise(id: string, workspaceId: string): Promise<void> {
    await indexedDbPromiseLedgerRepository.delete(id)
    if (workspaceId) {
      await storyStateMaterializer.materialize(workspaceId).catch(() => undefined)
    }
  },
}
