import type { TaskScope } from '../types/taskScope'

/**
 * 统一 AI 产物/建议生命周期状态 (P1.12, INV-07, INV-08)
 */
export type AiResultLifecycleStatus =
  | 'requested' // 任务已提交/调度中
  | 'running' // 模型正在执行生成/分析
  | 'result' // 结果已生成，等待作者审阅
  | 'accepted' // 作者已采纳该建议/草案
  | 'committed' // 已原子落盘至正文/世界观数据库
  | 'dismissed' // 作者已关闭/拒绝
  | 'undone' // 写回后已成功撤销

export interface AiResultFinding {
  id: string
  title: string
  description: string
  severity?: 'info' | 'warning' | 'error'
  location?: {
    chapterId?: string
    from?: number
    to?: number
  }
  suggestion?: string
}

export interface AiResultProvenance {
  provider: string
  model: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  sourceRevision: number
  contextSourcesCount?: number
  cacheHit?: boolean
  timestamp: number
}

/**
 * 跨所有插件与 AI 动作的标准化结果描述
 */
export interface StandardAiResult<T = unknown> {
  id: string
  taskId: string
  scope: TaskScope
  kind: string
  title: string
  summary: string
  status: AiResultLifecycleStatus
  data?: T
  findings?: AiResultFinding[]
  provenance: AiResultProvenance
  proposalId?: string
  createdAt: number
  updatedAt: number
}
