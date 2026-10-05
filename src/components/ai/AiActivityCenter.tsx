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
import type {
  AiResultFinding,
  AiResultLifecycleStatus,
  StandardAiResult,
} from '../../types/aiResultLifecycle'
import { LIFECYCLE_LABELS, humanizeTaskKind } from '../../ai/results/standardAiResult'
import {
  redactPluginValue as redactSensitive,
  redactSensitiveString,
} from '../../core/pluginDataRedaction'
import { Tooltip } from '../../ui/primitives'

const STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  running: '进行中',
  'waiting-user': '等待你的输入',
  checkpointed: '已保存进度',
  interrupted: '已中断',
  failed: '未完成',
}

const LIFECYCLE_TONES: Record<AiResultLifecycleStatus, string> = {
  requested: 'bg-gray-500/10 text-gray-400',
  running: 'bg-blue-500/10 text-blue-500',
  result: 'bg-amber-500/10 text-amber-500',
  accepted: 'bg-emerald-500/10 text-emerald-500',
  committed: 'bg-emerald-500/10 text-emerald-500',
  dismissed: 'bg-gray-500/10 text-gray-400',
  undone: 'bg-rose-500/10 text-rose-500',
}

const SEVERITY_TONES: Record<NonNullable<AiResultFinding['severity']>, string> = {
  info: 'text-[var(--ink-text-muted)]',
  warning: 'text-amber-500',
  error: 'text-rose-500',
}

function humanizeStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export interface AiActivityCenterProps {
  /** 处于恢复或未结束状态的任务记录 */
  recoveryRecords: TaskRecoveryRecord[]
  /** 恢复加载状态 */
  loading?: boolean
  /** 恢复错误提示 */
  error?: string
  /** 本工作区的统一 AI 结果（Result Center 的唯一列表来源） */
  results?: StandardAiResult[]
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
  results = [],
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
                      <span>
                        {humanizeTaskKind(record.task.kind)}
                        <span className="sr-only">{record.task.kind}</span>
                      </span>
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
                        {humanizeStatus(status)}
                        <span className="sr-only">{status}</span>
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--ink-text-faint)] font-mono mt-0.5">
                      {taskId}
                    </div>
                  </div>

                  {/* 快捷操作 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(isInterrupted || status === 'checkpointed') && onResume && (
                      <Tooltip content="恢复任务">
                        <button
                          onClick={() => handleAction(taskId, onResume)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    {isRunning && onCancel && (
                      <Tooltip content="取消任务">
                        <button
                          onClick={() => handleAction(taskId, onCancel)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    {onDismiss && (
                      <Tooltip content="忽略/移除">
                        <button
                          onClick={() => handleAction(taskId, onDismiss)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
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

        {/* 2. 工作区统一结果中心 (True AI Result Center) */}
        {results.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
            <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] uppercase tracking-wider">
              结果中心 ({results.length})
            </div>

            {results.map((result) => {
              const isExpanded = Boolean(expandedDetails[result.id])
              const provenance = formatResultProvenance(result)
              return (
                <div
                  key={result.id}
                  data-testid={`activity-result-${result.id}`}
                  className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-[var(--ink-text)]">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--ink-accent)]" />
                      <span>{result.title}</span>
                      <span
                        data-testid={`result-status-${result.id}`}
                        className={`px-1.5 py-0.2 rounded text-[10px] ${LIFECYCLE_TONES[result.status]}`}
                      >
                        {LIFECYCLE_LABELS[result.status]}
                        <span className="sr-only">{result.status}</span>
                      </span>
                    </span>
                    <span className="text-[10px] shrink-0 text-[var(--ink-text-faint)]">
                      {new Date(result.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {result.summary && (
                    <p
                      data-testid={`result-summary-${result.id}`}
                      className="text-[var(--ink-text-muted)] leading-relaxed"
                    >
                      {result.summary}
                    </p>
                  )}

                  {result.data !== undefined && (
                    <pre
                      data-testid={`result-content-${result.id}`}
                      className="max-h-36 overflow-auto whitespace-pre-wrap rounded bg-[var(--ink-bg-panel)] p-2 text-[10px] text-[var(--ink-text)]"
                    >
                      {formatArtifactContent(result.data)}
                    </pre>
                  )}

                  {result.findings && result.findings.length > 0 && (
                    <ul data-testid={`result-findings-${result.id}`} className="space-y-1 pt-0.5">
                      {result.findings.map((finding) => (
                        <li
                          key={finding.id}
                          className={`flex items-start gap-1.5 text-[10px] ${SEVERITY_TONES[finding.severity ?? 'info']}`}
                        >
                          {finding.severity === 'warning' || finding.severity === 'error' ? (
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                          )}
                          <span className="leading-relaxed">
                            <span className="font-medium">{finding.title}</span>
                            {finding.description && <>：{finding.description}</>}
                            {finding.suggestion && (
                              <span className="text-[var(--ink-text-muted)]">
                                {' '}
                                · 建议：{finding.suggestion}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() => toggleDetails(result.id)}
                      className="flex items-center gap-1 text-[10px] text-[var(--ink-accent)] hover:underline shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>{isExpanded ? '收起详情' : '查看范围与溯源'}</span>
                    </button>
                    {provenance && (
                      <span
                        data-testid={`result-provenance-${result.id}`}
                        className="text-[10px] text-[var(--ink-text-faint)] truncate"
                      >
                        {provenance}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div
                      data-testid={`result-details-${result.id}`}
                      className="mt-1.5 p-2 rounded bg-[var(--ink-bg-panel)] font-mono text-[10px] text-[var(--ink-text-muted)] space-y-0.5"
                    >
                      <div>任务: {result.taskId}</div>
                      <div>类型: {result.kind}</div>
                      <div>
                        工作区: {result.scope.workspaceId} @r{result.scope.workspaceRevision}
                      </div>
                      {result.scope.document && (
                        <div>
                          章节: {result.scope.document.id} @r{result.scope.document.revision}
                        </div>
                      )}
                      {result.scope.selection && (
                        <div>
                          选区: {result.scope.selection.from}-{result.scope.selection.to}
                        </div>
                      )}
                      {result.proposalId && <div>建议: {result.proposalId}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatArtifactContent(value: unknown): string {
  if (typeof value === 'string') return redactSensitiveString(value).slice(0, 4000)
  try {
    return JSON.stringify(redactSensitive(value), null, 2).slice(0, 4000)
  } catch {
    return '[无法渲染产物内容]'
  }
}

/**
 * One-line provenance summary. Model fields are optional because local tools and
 * workflows produce results without a provider call, so a result may legitimately
 * carry only a timestamp.
 */
function formatResultProvenance(result: StandardAiResult): string {
  const p = result.provenance
  const parts: string[] = []
  if (p.provider) parts.push(p.model ? `${p.provider}/${p.model}` : p.provider)
  if (p.latencyMs !== undefined) parts.push(`${p.latencyMs}ms`)
  if (p.inputTokens !== undefined || p.outputTokens !== undefined) {
    parts.push(`${p.inputTokens ?? '?'}→${p.outputTokens ?? '?'} tokens`)
  }
  if (p.contextSourcesCount !== undefined) parts.push(`${p.contextSourcesCount} 个上下文`)
  if (p.cacheHit !== undefined) parts.push(p.cacheHit ? '缓存命中' : '未命中缓存')
  if (p.sourceRevision !== undefined) parts.push(`源版本 r${p.sourceRevision}`)
  return redactSensitiveString(parts.join(' · '))
}
