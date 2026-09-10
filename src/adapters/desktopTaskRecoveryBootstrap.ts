import {
  TaskExecutionSnapshotSchema,
  Value,
  type AiTask,
  type TaskExecutionSnapshot,
  type TaskStatus,
  type TaskStatusSnapshot,
} from '@inkpi/protocol'
import { clock as systemClock } from './clock'
import type { TaskRecoveryRecord, TaskRecoveryStore } from '../db/taskRecoveryStore'
import type { Clock } from '../ports/clock'

const RESTART_RESUMABLE_STATUSES: readonly TaskStatus[] = [
  'created',
  'queued',
  'running',
  'checkpointed',
]

const TASK_STATUSES: readonly TaskStatus[] = [
  ...RESTART_RESUMABLE_STATUSES,
  'waiting-user',
  'interrupted',
  'completed',
  'failed',
  'cancelled',
]

export type DesktopTaskRecoveryIssueKind = 'protocol' | 'remote' | 'persistence'

export interface DesktopTaskRecoveryIssue {
  taskId?: string
  kind: DesktopTaskRecoveryIssueKind
  message: string
}

export interface DesktopTaskRecoveryReport {
  projectId: string
  /** Records that remain visible to the App after reconciliation. */
  records: TaskRecoveryRecord[]
  /** Task ids whose daemon execution was successfully reattached. */
  recoveredTaskIds: string[]
  /** Task ids filtered because the daemon or App already reports completion. */
  completedTaskIds: string[]
  /** Task ids collapsed when a store returned duplicate records. */
  duplicateTaskIds: string[]
  /** Per-task protocol, remote, or persistence problems. */
  issues: DesktopTaskRecoveryIssue[]
}

export interface DesktopTaskRecoveryBootstrapOptions {
  projectId: string
  store: TaskRecoveryStore
  clock?: Clock
  /**
   * Reads the daemon's durable execution view. Omit this for offline startup;
   * local in-flight records are then normalized to interrupted.
   */
  getTaskExecution?: (taskId: string) => Promise<TaskExecutionSnapshot>
}

export class DesktopTaskRecoveryProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesktopTaskRecoveryProtocolError'
  }
}

const bootstrapQueues = new WeakMap<TaskRecoveryStore, Map<string, Promise<void>>>()

/**
 * Loads the App-owned task projection and reconciles it with the daemon's
 * durable task.execution view after startup or reconnect.
 *
 * The daemon is authoritative for a task that can be queried. Completed tasks
 * are removed from the App projection; every other valid status is persisted
 * once under its task id so repeated bootstrap calls remain idempotent.
 */
export async function bootstrapDesktopTaskRecovery(
  options: DesktopTaskRecoveryBootstrapOptions,
): Promise<DesktopTaskRecoveryReport> {
  let projectQueues = bootstrapQueues.get(options.store)
  if (!projectQueues) {
    projectQueues = new Map()
    bootstrapQueues.set(options.store, projectQueues)
  }
  const previous = projectQueues.get(options.projectId) ?? Promise.resolve()
  const run = previous.then(
    () => runBootstrapDesktopTaskRecovery(options),
    () => runBootstrapDesktopTaskRecovery(options),
  )
  const settled = run.then(
    () => undefined,
    () => undefined,
  )
  projectQueues.set(options.projectId, settled)
  void settled.then(() => {
    if (projectQueues?.get(options.projectId) === settled) {
      projectQueues.delete(options.projectId)
    }
  })
  return run
}

async function runBootstrapDesktopTaskRecovery(
  options: DesktopTaskRecoveryBootstrapOptions,
): Promise<DesktopTaskRecoveryReport> {
  const clockPort = options.clock ?? systemClock
  const storedRecords = await options.store.list(options.projectId)
  const deduplicated = deduplicateRecords(storedRecords, options.projectId)
  const report: DesktopTaskRecoveryReport = {
    projectId: options.projectId,
    records: [],
    recoveredTaskIds: [],
    completedTaskIds: [],
    duplicateTaskIds: deduplicated.duplicateTaskIds,
    issues: deduplicated.issues,
  }

  for (const record of deduplicated.records) {
    await reconcileRecord(record, options, clockPort, report)
  }

  report.records.sort((left, right) => {
    return right.updatedAt - left.updatedAt
  })
  return report
}

/** Explicit alias for callers that already describe the operation as reconcile. */
export const reconcileDesktopTaskRecovery = bootstrapDesktopTaskRecovery

async function reconcileRecord(
  record: TaskRecoveryRecord,
  options: DesktopTaskRecoveryBootstrapOptions,
  clockPort: Clock,
  report: DesktopTaskRecoveryReport,
): Promise<void> {
  const taskId = record.task.id
  if (record.snapshot.status === 'completed') {
    report.completedTaskIds.push(taskId)
    await removeRecord(options.store, record, report)
    return
  }

  if (!options.getTaskExecution) {
    const localRecord = normalizeLocalRecord(record, clockPort.now())
    await saveRecordIfChanged(options.store, record, localRecord, report)
    report.records.push(localRecord)
    return
  }

  try {
    const execution = assertTaskExecutionSnapshot(
      await options.getTaskExecution(taskId),
      record.task,
    )
    if (execution.snapshot.status === 'completed') {
      report.completedTaskIds.push(taskId)
      await removeRecord(options.store, record, report)
      return
    }

    const reconciledRecord = {
      ...record,
      snapshot: toRecoverySnapshot(execution.snapshot),
      updatedAt: clockPort.now(),
    }
    await saveRecord(options.store, reconciledRecord, report)
    report.records.push(reconciledRecord)
    report.recoveredTaskIds.push(taskId)
  } catch (error: unknown) {
    const issue = recoveryIssue(taskId, error)
    report.issues.push(issue)
    const fallback = fallbackRecord(record, clockPort.now(), issue)
    await saveRecord(options.store, fallback, report)
    report.records.push(fallback)
  }
}

function deduplicateRecords(
  records: TaskRecoveryRecord[],
  projectId: string,
): {
  records: TaskRecoveryRecord[]
  duplicateTaskIds: string[]
  issues: DesktopTaskRecoveryIssue[]
} {
  const byTaskId = new Map<string, TaskRecoveryRecord>()
  const duplicateTaskIds = new Set<string>()
  const issues: DesktopTaskRecoveryIssue[] = []

  for (const record of records) {
    if (record.projectId !== projectId) {
      issues.push({
        taskId: record.task?.id,
        kind: 'protocol',
        message: 'Task recovery store returned a record for another project',
      })
      continue
    }
    const taskId = record.task?.id
    if (!taskId || !record.task.kind || !TASK_STATUSES.includes(record.snapshot?.status)) {
      issues.push({
        taskId,
        kind: 'protocol',
        message: 'Task recovery store returned an invalid task record',
      })
      continue
    }
    const existing = byTaskId.get(taskId)
    if (!existing) {
      byTaskId.set(taskId, record)
      continue
    }
    duplicateTaskIds.add(taskId)
    if (record.updatedAt >= existing.updatedAt) byTaskId.set(taskId, record)
  }

  return {
    records: [...byTaskId.values()],
    duplicateTaskIds: [...duplicateTaskIds],
    issues,
  }
}

function normalizeLocalRecord(record: TaskRecoveryRecord, now: number): TaskRecoveryRecord {
  const snapshot = toRecoverySnapshot(record.snapshot)
  if (!RESTART_RESUMABLE_STATUSES.includes(snapshot.status)) {
    return snapshot === record.snapshot ? record : { ...record, snapshot }
  }
  return {
    ...record,
    snapshot: {
      ...snapshot,
      status: 'interrupted',
      finishedAt: undefined,
      error: undefined,
    },
    updatedAt: now,
  }
}

function fallbackRecord(
  record: TaskRecoveryRecord,
  now: number,
  issue: DesktopTaskRecoveryIssue,
): TaskRecoveryRecord {
  const normalized = normalizeLocalRecord(record, now)
  if (!RESTART_RESUMABLE_STATUSES.includes(record.snapshot.status)) return normalized
  return {
    ...normalized,
    snapshot: {
      ...normalized.snapshot,
      status: 'interrupted',
      finishedAt: now,
      error: {
        code:
          issue.kind === 'protocol'
            ? 'DESKTOP_TASK_RECOVERY_PROTOCOL_ERROR'
            : 'DESKTOP_TASK_RECOVERY_REMOTE_ERROR',
        message: issue.message,
        retryable: true,
      },
    },
    updatedAt: now,
  }
}

function toRecoverySnapshot(snapshot: TaskStatusSnapshot): TaskStatusSnapshot {
  if (snapshot.result === undefined && snapshot.error?.details === undefined) return snapshot
  return {
    taskId: snapshot.taskId,
    kind: snapshot.kind,
    status: snapshot.status,
    ...(typeof snapshot.progress === 'number' ? { progress: snapshot.progress } : {}),
    ...(snapshot.startedAt === undefined ? {} : { startedAt: snapshot.startedAt }),
    ...(snapshot.finishedAt === undefined ? {} : { finishedAt: snapshot.finishedAt }),
    ...(snapshot.executionRunId ? { executionRunId: snapshot.executionRunId } : {}),
    ...(snapshot.attempts === undefined ? {} : { attempts: snapshot.attempts }),
    ...(snapshot.checkpoint ? { checkpoint: { ...snapshot.checkpoint } } : {}),
    ...(snapshot.error
      ? {
          error: {
            code: snapshot.error.code,
            message: snapshot.error.message,
            ...(snapshot.error.retryable === undefined
              ? {}
              : { retryable: snapshot.error.retryable }),
          },
        }
      : {}),
  }
}

function assertTaskExecutionSnapshot(value: unknown, expectedTask: AiTask): TaskExecutionSnapshot {
  const errors = Value.Errors(TaskExecutionSnapshotSchema, value)
  if (errors.length > 0) {
    const first = errors[0]
    throw new DesktopTaskRecoveryProtocolError(
      'Invalid task.execution response for ' +
        expectedTask.id +
        ' (' +
        first.path +
        ': ' +
        first.message +
        ')',
    )
  }

  const execution = value as TaskExecutionSnapshot
  if (
    execution.task.id !== expectedTask.id ||
    execution.task.kind !== expectedTask.kind ||
    execution.snapshot.taskId !== expectedTask.id ||
    execution.snapshot.kind !== expectedTask.kind
  ) {
    throw new DesktopTaskRecoveryProtocolError(
      'Task execution identity does not match persisted task ' + expectedTask.id,
    )
  }
  return execution
}

function recoveryIssue(taskId: string, error: unknown): DesktopTaskRecoveryIssue {
  if (error instanceof DesktopTaskRecoveryProtocolError) {
    return { taskId, kind: 'protocol', message: error.message }
  }
  return {
    taskId,
    kind: 'remote',
    message: error instanceof Error ? error.message : String(error),
  }
}

async function saveRecord(
  store: TaskRecoveryStore,
  record: TaskRecoveryRecord,
  report: DesktopTaskRecoveryReport,
): Promise<void> {
  try {
    await store.save(record)
  } catch (error: unknown) {
    report.issues.push({
      taskId: record.task.id,
      kind: 'persistence',
      message: 'Could not persist task recovery state: ' + errorMessage(error),
    })
  }
}

async function saveRecordIfChanged(
  store: TaskRecoveryStore,
  previous: TaskRecoveryRecord,
  next: TaskRecoveryRecord,
  report: DesktopTaskRecoveryReport,
): Promise<void> {
  if (next === previous) return
  await saveRecord(store, next, report)
}

async function removeRecord(
  store: TaskRecoveryStore,
  record: TaskRecoveryRecord,
  report: DesktopTaskRecoveryReport,
): Promise<void> {
  try {
    await store.remove(record.projectId, record.task.id)
  } catch (error: unknown) {
    report.issues.push({
      taskId: record.task.id,
      kind: 'persistence',
      message: 'Could not remove completed task recovery state: ' + errorMessage(error),
    })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
