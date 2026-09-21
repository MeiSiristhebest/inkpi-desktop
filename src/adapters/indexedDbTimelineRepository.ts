import { db } from '../db/indexedDB'
import type { TimelineNode, NarrativeThread } from '../plugins/timeline-grid/types'
import type { TimelineRepository } from '../ports/timelineRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

/**
 * IndexedDB 时空大纲仓储适配器：把端口方法映射到 timelineNodes 和 narrativeThreads 表。
 */
export const indexedDbTimelineRepository: TimelineRepository = {
  getAllThreads: () => db.getAll<NarrativeThread>('narrativeThreads'),
  saveThread: async (thread) => {
    const existing = await db.get<NarrativeThread>('narrativeThreads', thread.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'narrative-thread',
      aggregateId: thread.id,
      workspaceId: thread.projectId,
      store: 'narrativeThreads',
      record: thread,
      existing,
    })
  },
  deleteThread: async (id) => {
    const existing = await db.get<NarrativeThread>('narrativeThreads', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'narrative-thread',
      aggregateId: id,
      store: 'narrativeThreads',
      existing,
    })
  },
  getAllNodes: () => db.getAll<TimelineNode>('timelineNodes'),
  saveNode: async (node) => {
    const existing = await db.get<TimelineNode>('timelineNodes', node.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'timeline-node',
      aggregateId: node.id,
      workspaceId: node.projectId,
      store: 'timelineNodes',
      record: node,
      existing,
    })
  },
  deleteNode: async (id) => {
    const existing = await db.get<TimelineNode>('timelineNodes', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'timeline-node',
      aggregateId: id,
      store: 'timelineNodes',
      existing,
    })
  },
}
