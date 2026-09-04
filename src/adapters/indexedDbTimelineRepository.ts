import { db } from '../db/indexedDB'
import type { TimelineNode, NarrativeThread } from '../plugins/timeline-grid/types'
import type { TimelineRepository } from '../ports/timelineRepository'

/**
 * IndexedDB 时空大纲仓储适配器：把端口方法映射到 timelineNodes 和 narrativeThreads 表。
 */
export const indexedDbTimelineRepository: TimelineRepository = {
  getAllThreads: () => db.getAll<NarrativeThread>('narrativeThreads'),
  saveThread: (thread) => db.put('narrativeThreads', thread),
  deleteThread: (id) => db.delete('narrativeThreads', id),
  getAllNodes: () => db.getAll<TimelineNode>('timelineNodes'),
  saveNode: (node) => db.put('timelineNodes', node),
  deleteNode: (id) => db.delete('timelineNodes', id),
}
