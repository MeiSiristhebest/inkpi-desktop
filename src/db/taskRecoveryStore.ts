import type { AiTask, TaskStatus, TaskStatusSnapshot } from '@inkpi/protocol'
import { db } from './indexedDB'

/**
 * Desktop-owned projection of a task that may need attention after a reload.
 * The task is retained so the daemon can resume it; the snapshot deliberately
 * contains status metadata only and never stores model output.
 */
export interface TaskRecoveryRecord {
  projectId: string
  task: AiTask
  snapshot: TaskStatusSnapshot
  updatedAt: number
}

export interface TaskRecoveryStore {
  list(projectId: string): Promise<TaskRecoveryRecord[]>
  save(record: TaskRecoveryRecord): Promise<void>
  remove(projectId: string, taskId: string): Promise<void>
}

interface SettingsKVRecord {
  key: string
  value: unknown
}

const KEY_PREFIX = 'ai-task-recovery::'
const TASK_STATUSES: readonly TaskStatus[] = [
  'created',
  'queued',
  'running',
  'checkpointed',
  'waiting-user',
  'interrupted',
  'completed',
  'failed',
  'cancelled',
]

const encodeKeyPart = (value: string): string => encodeURIComponent(value)

export const taskRecoveryKey = (projectId: string, taskId: string): string =>
  `${KEY_PREFIX}${encodeKeyPart(projectId)}::${encodeKeyPart(taskId)}`

/** IndexedDB implementation using the existing settingsKV store. */
export class IndexedDbTaskRecoveryStore implements TaskRecoveryStore {
  async list(projectId: string): Promise<TaskRecoveryRecord[]> {
    const prefix = `${KEY_PREFIX}${encodeKeyPart(projectId)}::`
    const records = await db.getAll<SettingsKVRecord>('settingsKV')
    return records
      .filter((record) => record.key.startsWith(prefix))
      .map((record) => record.value)
      .filter((value): value is TaskRecoveryRecord => isTaskRecoveryRecord(value, projectId))
  }

  async save(record: TaskRecoveryRecord): Promise<void> {
    await db.put<SettingsKVRecord>('settingsKV', {
      key: taskRecoveryKey(record.projectId, record.task.id),
      value: record,
    })
  }

  async remove(projectId: string, taskId: string): Promise<void> {
    await db.delete('settingsKV', taskRecoveryKey(projectId, taskId))
  }
}

export const indexedDbTaskRecoveryStore = new IndexedDbTaskRecoveryStore()

function isTaskRecoveryRecord(value: unknown, projectId: string): value is TaskRecoveryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<TaskRecoveryRecord>
  const task = record.task
  const snapshot = record.snapshot
  if (record.projectId !== projectId || !Number.isFinite(record.updatedAt)) return false
  if (!task || typeof task !== 'object' || typeof task.id !== 'string' || typeof task.kind !== 'string') return false
  if (!task.input || typeof task.input !== 'object') return false
  if (!snapshot || typeof snapshot !== 'object') return false
  return snapshot.taskId === task.id
    && snapshot.kind === task.kind
    && typeof snapshot.status === 'string'
    && TASK_STATUSES.includes(snapshot.status as TaskStatus)
}
