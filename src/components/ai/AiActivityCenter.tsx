import { useState, type FC } from 'react'
import {
  Activity,
  Play,
  XCircle,
  AlertTriangle,
  Send,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'
import type { AiArtifact } from '../../ai/artifacts/artifactStore'

export interface ActivityResultItem {
  id: string
  kind: string
  title: string
  summary: string
  completedAt: number
  status: 'completed' | 'failed'
  artifact?: AiArtifact
}

export interface AiActivityCenterProps {
  /** 处于恢复或未结束状态的任务记录 */
  recoveryRecords: TaskRecoveryRecord[]
  /** 恢复加载状态 */
  loading?: boolean
  /** 恢复错误提示 */
  error?: string
  /** 历史已完成/沉淀的结果列表（可选） */
  recentResults?: ActivityResultItem[]
  /** 工作区产物列表（可选） */
  artifacts?: AiArtifact[]
  /** 交互回调 */
  onResume?: (taskId: string) => Promise<boolean>
  onCancel?: (taskId: string) => Promise<boolean>
  onDismiss?: (taskId: string) => Promise<boolean>
  onSteer?: (taskId: string, input: unknown) => Promise<boolean>
}

export const AiActivityCenter: FC<AiActivityCenterProps> = ({
  recoveryRecords,
  loading = false,
  error,
  recentResults = [],
  artifacts = [],
  onResume,
  onCancel,
  onDismiss,
  onSteer,
}) => {
  const [steerInputs, setSteerInputs] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSteer = async (taskId: string) => {
    const text = (steerInputs[taskId] || '').trim()
    if (!text || !onSteer) return
    try {
      setProcessingId(taskId)
      await onSteer(taskId, { direction: text })
      setSteerInputs((prev) => ({ ...prev, [taskId]: '' }))
    } finally {
      setProcessingId(null)
    }
  }

  const handleAction = async (
    taskId: string,
    action: ((id: string) => Promise<boolean>) | undefined,
  ) => {
    if (!action) return
    try {
      setProcessingId(taskId)
      await action(taskId)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div
      data-testid="ai-activity-center"
      className="flex flex-col h-full bg-[var(--ink-bg-panel)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/50">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-text)]">
          <Activity className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
          任务执行与活动中心
        </span>
        <span className="text-[11px] text-[var(--ink-text-faint)]">
          {recoveryRecords.length} 项关注
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-lg text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20"
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="py-6 text-center text-[12px] text-[var(--ink-text-faint)]">
            加载活动状态中…
          </div>
        )}

        {/* 1. 待处理/进行中任务 */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] uppercase tracking-wider">
            活跃与待恢复任务 ({recoveryRecords.length})
          </div>

          {recoveryRecords.length === 0 && !loading && (
            <div className="p-4 rounded-xl border border-dashed border-[var(--ink-border)] text-center text-[12px] text-[var(--ink-text-faint)]">
              所有后台任务已完成，无挂起活动
            </div>
          )}

          {recoveryRecords.map((record) => {
            const taskId = record.task.id
            const status = record.snapshot.status
            const isWaitingUser = status === 'waiting-user'
            const isInterrupted = status === 'interrupted' || status === 'failed'
            const isRunning = status === 'running' || status === 'queued'
            const isProcessing = processingId === taskId

            return (
              <div
                key={taskId}
                data-testid={`activity-task-${taskId}`}
                className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-2.5 text-[12px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-[var(--ink-text)]">
                      <span>{record.task.kind}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] ${
                          isRunning
                            ? 'bg-blue-500/10 text-blue-500'
                            : isWaitingUser
                              ? 'bg-amber-500/10 text-amber-500'
                              : isInterrupted
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--ink-text-faint)] font-mono mt-0.5">
                      {taskId}
                    </div>
                  </div>

                  {/* 快捷操作 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(isInterrupted || status === 'checkpointed') && onResume && (
                      <button
                        onClick={() => handleAction(taskId, onResume)}
                        disabled={isProcessing}
                        title="恢复任务"
                        className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isRunning && onCancel && (
                      <button
                        onClick={() => handleAction(taskId, onCancel)}
                        disabled={isProcessing}
                        title="取消任务"
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => handleAction(taskId, onDismiss)}
                        disabled={isProcessing}
                        title="忽略/移除"
                        className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                {record.snapshot.progress !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[var(--ink-text-faint)]">
                      <span>进度</span>
                      <span>{Math.round((record.snapshot.progress || 0) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--ink-bg-panel)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--ink-accent)] transition-all duration-300"
                        style={{ width: `${Math.round((record.snapshot.progress || 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 等待人工引导 (steering) */}
                {isWaitingUser && onSteer && (
                  <div className="pt-2 border-t border-[var(--ink-border)] space-y-1.5">
                    <div className="text-[11px] text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>等待输入引导：</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={steerInputs[taskId] || ''}
                        onChange={(e) =>
                          setSteerInputs((prev) => ({ ...prev, [taskId]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            void handleSteer(taskId)
                          }
                        }}
                        placeholder="输入修正方向或指令…"
                        className="flex-1 px-2 py-1 rounded text-[11px] bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)] text-[var(--ink-text)]"
                      />
                      <button
                        onClick={() => void handleSteer(taskId)}
                        disabled={isProcessing || !(steerInputs[taskId] || '').trim()}
                        className="px-2.5 py-1 rounded text-[11px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors disabled:opacity-40 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        引导
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 2. 工作区产物与完成结果 (True AI Result Center) */}
        {(recentResults.length > 0 || artifacts.length > 0) && (
          <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
            <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] uppercase tracking-wider">
              产物与已完成结果 ({recentResults.length + artifacts.length})
            </div>

            {/* Recent Results */}
            {recentResults.map((item) => {
              const isExpanded = Boolean(expandedDetails[item.id])
              return (
                <div
                  key={item.id}
                  data-testid={`activity-result-${item.id}`}
                  className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--ink-text)]">{item.title}</span>
                    <span className="text-[10px] text-[var(--ink-text-faint)]">
                      {new Date(item.completedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[var(--ink-text-muted)] leading-relaxed">{item.summary}</p>
                  {item.artifact && (
                    <div className="pt-1">
                      <button
                        onClick={() => toggleDetails(item.id)}
                        className="flex items-center gap-1 text-[10px] text-[var(--ink-accent)] hover:underline"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>{isExpanded ? '收起溯源参数' : '查看参数与溯源 (Advanced)'}</span>
                      </button>
                      {isExpanded && (
                        <div
                          data-testid={`result-details-${item.id}`}
                          className="mt-1.5 p-2 rounded bg-[var(--ink-bg-panel)] font-mono text-[10px] text-[var(--ink-text-muted)] space-y-0.5"
                        >
                          <div>ID: {item.artifact.id}</div>
                          <div>任务: {item.artifact.taskId}</div>
                          <div>类型: {item.artifact.type}</div>
                          <div>版本: {item.artifact.version}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Standalone Artifacts */}
            {artifacts.map((art) => {
              const isExpanded = Boolean(expandedDetails[art.id])
              return (
                <div
                  key={art.id}
                  data-testid={`activity-artifact-${art.id}`}
                  className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-[var(--ink-text)]">
                      <FileText className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                      {art.type}
                    </span>
                    <span className="text-[10px] text-[var(--ink-text-faint)]">
                      v{art.version} · {new Date(art.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={() => toggleDetails(art.id)}
                      className="flex items-center gap-1 text-[10px] text-[var(--ink-accent)] hover:underline"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>{isExpanded ? '收起溯源参数' : '查看溯源详情 (Advanced)'}</span>
                    </button>
                    {isExpanded && (
                      <div
                        data-testid={`artifact-details-${art.id}`}
                        className="mt-1.5 p-2 rounded bg-[var(--ink-bg-panel)] font-mono text-[10px] text-[var(--ink-text-muted)] space-y-0.5"
                      >
                        <div>ID: {art.id}</div>
                        <div>Task ID: {art.taskId}</div>
                        <div>Workspace: {art.ownership?.workspaceId || '—'}</div>
                        <div>Source Rev: {art.provenance?.sourceRevision ?? '—'}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
