import type { TimelineNode, NarrativeThread } from '../plugins/timeline-grid/types'

/**
 * 时空因果大纲仓储端口（抽象）。
 */
export interface TimelineRepository {
  getAllThreads(): Promise<NarrativeThread[]>
  saveThread(thread: NarrativeThread): Promise<void>
  deleteThread(id: string): Promise<void>
  getAllNodes(): Promise<TimelineNode[]>
  saveNode(node: TimelineNode): Promise<void>
  deleteNode(id: string): Promise<void>
}
