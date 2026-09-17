import { db } from '../db/indexedDB'
import {
  projectPluginRecordsToStoryState,
  type StoryPluginCollectionInput,
} from '../domain/story/pluginProjection'
import type { StoryState } from '../domain/story'
import { serializeStoryState } from '../domain/story/storyStateSerialization'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { StoryStateStore } from '../ports/storyStateStore'
import { storyStateEvents } from '../ports/storyStateEvents'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'

/**
 * 生产级 StoryState 物化器（StoryState Production Materializer）
 * 职责：
 * 1. 从 IndexedDB（living-codex, timeline-grid, promise-ledger）读取指定 workspaceId 的全部领域数据；
 * 2. 自动补充或规范化 provenance 字段（遵循 INV-05：事实源合规）；
 * 3. 驱动 pure function projectPluginRecordsToStoryState() 计算 canonical StoryState；
 * 4. 如果内容发生改变，递增 revision 并落入 StoryStateStore；
 * 5. 发布 domainChangeEvents 通知 UI 与 AI 上下文完成实时状态同步。
 */
export class StoryStateMaterializer {
  private readonly store: StoryStateStore

  constructor(store: StoryStateStore = indexedDbStoryStateStore) {
    this.store = store
  }

  public async materialize(workspaceId: string): Promise<StoryState | undefined> {
    if (!workspaceId) return undefined

    // 1. 并发从持久化存储中读取 3 大核心世界观插件的数据
    const [allEntities, allThreads, allNodes, allPromises] = await Promise.all([
      db.getAll<CodexEntity>('codexEntities').catch(() => []),
      db.getAll<NarrativeThread>('narrativeThreads').catch(() => []),
      db.getAll<TimelineNode>('timelineNodes').catch(() => []),
      db.getAll<PromiseLedgerEntry>('promiseLedger').catch(() => []),
    ])

    // 按 workspaceId 严格过滤（遵循 INV-03: 数据永不串）
    const entities = allEntities.filter((e) => e.projectId === workspaceId)
    const threads = allThreads.filter((t) => t.projectId === workspaceId)
    const nodes = allNodes.filter((n) => n.projectId === workspaceId)
    const promises = allPromises.filter((p) => p.projectId === workspaceId)

    // 2. 遵循 INV-05 fail-closed 溯源保护：
    // 未显式提供可信 provenance 的历史/导入数据，降级标记为 'derived'/'hypothesis'，绝不静默伪造成 'canonical-fact'
    const fallbackProvenance = {
      sourceType: 'derived' as const,
      factLevel: 'hypothesis' as const,
    }

    const codexRecords = entities.map((e) => ({
      ...e,
      provenance: (e as any).provenance ?? fallbackProvenance,
    }))

    const threadRecords = threads.map((t) => ({
      ...t,
      provenance: (t as any).provenance ?? fallbackProvenance,
    }))

    const nodeRecords = nodes.map((n) => ({
      ...n,
      provenance: (n as any).provenance ?? fallbackProvenance,
    }))

    const promiseRecords = promises.map((p) => ({
      ...p,
      provenance: (p as any).provenance ?? fallbackProvenance,
    }))

    // 3. 构建投影输入集合
    const sources: StoryPluginCollectionInput[] = [
      {
        sourceId: 'living-codex',
        collection: 'entities',
        records: codexRecords,
      },
      {
        sourceId: 'timeline-grid',
        collection: 'thread',
        records: threadRecords,
      },
      {
        sourceId: 'timeline-grid',
        collection: 'node',
        records: nodeRecords,
      },
      {
        sourceId: 'promise-ledger',
        collection: 'entry',
        records: promiseRecords,
      },
    ]

    // 4. 读取当前已存的 StoryState 获取当前 revision
    const existingState = await this.store.load(workspaceId)
    const currentRevision = existingState?.revision ?? 0
    const nextRevision = currentRevision + 1

    // 5. 投影生成新的 plugin 分区数据
    const projectedState = projectPluginRecordsToStoryState(sources, { revision: nextRevision })

    // 6. 分区物化保护（Partition Merging）：
    // 仅更新这 3 个插件所拥有的分区（entities, timelines, events, promises）；
    // 严格保留现有 StoryState 中的其他分区（relations, scenes, constraints, accepted distillation facts 等），避免被破坏
    const newState: StoryState = {
      revision: nextRevision,
      entities: projectedState.entities,
      relations: existingState?.relations ?? {},
      events: projectedState.events,
      scenes: existingState?.scenes ?? {},
      timelines: projectedState.timelines,
      promises: projectedState.promises,
      constraints: existingState?.constraints ?? {},
    }

    // 比较内容是否产生实质变化（忽略 revision 本身）
    if (existingState && isStateContentEqual(existingState, newState)) {
      return existingState
    }

    // 7. 持久化权威 StoryState
    await this.store.save(workspaceId, newState)

    // 8. 触发 StoryState 专用事件（解耦 Workspace 权威写入轴与 Materialized 读模型轴）
    storyStateEvents.publish(workspaceId, nextRevision)

    return newState
  }
}

export const storyStateMaterializer = new StoryStateMaterializer()

function isStateContentEqual(a: StoryState, b: StoryState): boolean {
  const cleanA = { ...a, revision: 0 }
  const cleanB = { ...b, revision: 0 }
  return serializeStoryState(cleanA) === serializeStoryState(cleanB)
}

