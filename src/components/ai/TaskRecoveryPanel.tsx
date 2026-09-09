import { useState } from 'react'
import type { TaskStatus } from '@inkpi/protocol'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'

interface TaskRecoveryPanelProps {
  records: TaskRecoveryRecord[]
  loading?: boolean
  error?: string
  onResume: (taskId: string) => Promise<boolean>
  onCancel: (taskId: string) => Promise<boolean>
  onDismiss: (taskId: string) => Promise<boolean>
}

const statusLabels: Record<TaskStatus, string> = {
  created: '已创建',
  queued: '排队中',
  running: '运行中',
  checkpointed: '已保存检查点',
  'waiting-user': '等待确认',
  interrupted: '已中断，可恢复',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const taskStatusLabel = (status: TaskStatus): string => statusLabels[status]

const canResume = (status: TaskStatus): boolean =>
  status === 'interrupted' || status === 'failed' || status === 'cancelled' || status === 'waiting-user'

const canCancel = (status: TaskStatus): boolean =>
  status === 'queued' || status === 'running' || status === 'checkpointed'

export const TaskRecoveryPanel: React.FC<TaskRecoveryPanelProps> = ({
  records,
  loading = false,
  error,
  onResume,
  onCancel,
  onDismiss,
}) => {
  const [busyTaskId, setBusyTaskId] = useState<string>()

  if (!loading && records.length === 0 && !error) return null

  const runAction = async (taskId: string, action: () => Promise<boolean>) => {
    setBusyTaskId(taskId)
    try {
      await action()
    } finally {
      setBusyTaskId(undefined)
    }
  }

  return (
    <section
      data-testid="task-recovery-panel"
      aria-label="AI 任务状态"
      className="fixed bottom-10 right-4 z-40 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3 text-xs shadow-[var(--ink-shadow-lg)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium text-[var(--ink-text)]">AI 任务状态</h2>
        {loading && <span className="text-[var(--ink-text-faint)]">读取中…</span>}
      </div>

      {error && <p role="alert" className="mb-2 text-rose-500">任务状态保存失败：{error}</p>}

      <div className="space-y-2">
        {records.map((record) => {
          const status = record.snapshot.status
          const busy = busyTaskId === record.task.id
          return (
            <div
              key={record.task.id}
              data-testid={`task-recovery-${record.task.id}`}
              className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-[var(--ink-text)]" title={record.task.kind}>
                  {record.task.kind}
                </span>
                <span data-testid={`task-status-${record.task.id}`} className="shrink-0 text-[var(--ink-text-muted)]">
                  {taskStatusLabel(status)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--ink-text-faint)]">
                {record.snapshot.checkpoint && <span>检查点：{record.snapshot.checkpoint.step}</span>}
                {typeof record.snapshot.progress === 'number' && (
                  <span>进度：{Math.round(record.snapshot.progress * 100)}%</span>
                )}
                {record.snapshot.error && <span role="alert" className="text-rose-500">{record.snapshot.error.message}</span>}
              </div>

              <div className="mt-2 flex items-center gap-2">
                {canResume(status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction(record.task.id, () => onResume(record.task.id))}
                    className="rounded bg-[var(--ink-accent)] px-2 py-1 text-white disabled:opacity-60"
                  >
                    {busy ? '处理中…' : '恢复'}
                  </button>
                )}
                {canCancel(status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction(record.task.id, () => onCancel(record.task.id))}
                    className="rounded border border-[var(--ink-border)] px-2 py-1 disabled:opacity-60"
                  >
                    取消
                  </button>
                )}
                {!canCancel(status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction(record.task.id, () => onDismiss(record.task.id))}
                    className="rounded border border-[var(--ink-border)] px-2 py-1 disabled:opacity-60"
                  >
                    关闭
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
