// 时空因果大纲网格 (timeline-grid) 领域模型与类型定义

export interface NarrativeThread {
  id: string
  projectId: string
  name: string
  color: string // 叙事线标识色彩 (HEX / CSS)
  characterIds: string[]
  order: number
}

export type NodeStatus = 'planned' | 'drafted' | 'completed' | 'cut'

export interface TimelineNode {
  id: string
  projectId: string
  threadId: string // 所属叙事动线 ID
  chapterOrder: number // X 轴位置（第几章）
  eventTitle: string
  summary: string // 供 AI 上下文消费的一句话摘要
  status: NodeStatus
  prerequisites: string[] // 前置事件节点 ID 列表
  causalOutcome: string // 因果演变结果
  nextEventIds?: string[] // 后置事件节点 ID 列表（双向缓存）
  relatedEntityIds: string[]
  emotionalPolarity: number // -1.0 (悲/绝境) ~ +1.0 (喜/爆点/爽)
  createdAt: number
  updatedAt: number
}

export interface NarrativeConflict {
  type: 'causal_cycle' | 'chapter_collision' | 'temporal_paradox'
  nodeIds: string[]
  description: string
  severity: 'error' | 'warning'
}

export interface EmotionalCurvePoint {
  chapter: number
  averagePolarity: number
}
