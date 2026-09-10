import type { AiTask, TaskExecutionSnapshot, TaskStatus, TaskStatusSnapshot } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { Clock } from '../ports/clock'
import type { TaskRecoveryRecord, TaskRecoveryStore } from '../db/taskRecoveryStore'
import { bootstrapDesktopTaskRecovery } from './desktopTaskRecoveryBootstrap'

const projectId = 'bootstrap-project'
const fixedClock: Clock = { now: () => 500 }

const makeTask = (id: string): AiTask => ({
  id,
  kind: 'creative.continue',
  input: { documentId: 'chapter-1', text: '片段' },
})

const makeSnapshot = (
  task: AiTask,
  status: TaskStatus,
  overrides: Partial<TaskStatusSnapshot> = {},
): TaskStatusSnapshot => ({
  taskId: task.id,
  kind: task.kind,
  status,
  ...overrides,
})

const makeRecord = (task: AiTask, status: TaskStatus, updatedAt = 10): TaskRecoveryRecord => ({
  projectId,
  task,
  snapshot: makeSnapshot(task, status),
  updatedAt,
})

const makeExecution = (
  task: AiTask,
  status: TaskStatus,
  updatedAt = 20,
): TaskExecutionSnapshot => ({
  task,
  snapshot: makeSnapshot(task, status),
  attempts: 1,
  updatedAt,
})

function makeStore(initial: TaskRecoveryRecord[] = []): TaskRecoveryStore & {
  records: TaskRecoveryRecord[]
  save: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
} {
  let records = [...initial]
  const save = vi.fn(async (record: TaskRecoveryRecord) => {
    records = [...records.filter((item) => item.task.id !== record.task.id), record]
  })
  const remove = vi.fn(async (_projectId: string, taskId: string) => {
    records = records.filter((item) => item.task.id !== taskId)
  })
  return {
    get records() {
      return records
    },
    list: vi.fn(async () => [...records]),
    save,
    remove,
  }
}

describe('desktop task recovery bootstrap', () => {
  it('starts cleanly with no persisted tasks', async () => {
    const store = makeStore()
    const getTaskExecution = vi.fn()

    await expect(
      bootstrapDesktopTaskRecovery({
        projectId,
        store,
        clock: fixedClock,
        getTaskExecution,
      }),
    ).resolves.toMatchObject({
      projectId,
      records: [],
      recoveredTaskIds: [],
      completedTaskIds: [],
      duplicateTaskIds: [],
      issues: [],
    })
    expect(getTaskExecution).not.toHaveBeenCalled()
  })

  it('reattaches a task on reconnect and remains idempotent after deduplication', async () => {
    const task = makeTask('reconnect-task')
    const store = makeStore([makeRecord(task, 'running', 10), makeRecord(task, 'checkpointed', 20)])
    const getTaskExecution = vi.fn(async () => makeExecution(task, 'checkpointed', 30))

    const first = await bootstrapDesktopTaskRecovery({
      projectId,
      store,
      clock: fixedClock,
      getTaskExecution,
    })
    const second = await bootstrapDesktopTaskRecovery({
      projectId,
      store,
      clock: fixedClock,
      getTaskExecution,
    })

    expect(first.duplicateTaskIds).toEqual(['reconnect-task'])
    expect(first.recoveredTaskIds).toEqual(['reconnect-task'])
    expect(first.records).toHaveLength(1)
    expect(second.duplicateTaskIds).toEqual([])
    expect(second.recoveredTaskIds).toEqual(['reconnect-task'])
    expect(second.records).toHaveLength(1)
    expect(store.records).toHaveLength(1)
    expect(store.records[0].snapshot.status).toBe('checkpointed')
    expect(getTaskExecution).toHaveBeenCalledTimes(2)
    expect(getTaskExecution).toHaveBeenNthCalledWith(1, task.id)
    expect(getTaskExecution).toHaveBeenNthCalledWith(2, task.id)
  })

  it('keeps recoverable tasks and filters both local and daemon-completed tasks', async () => {
    const interruptedTask = makeTask('interrupted-task')
    const failedTask = makeTask('failed-task')
    const localCompletedTask = makeTask('local-completed-task')
    const daemonCompletedTask = makeTask('daemon-completed-task')
    const store = makeStore([
      makeRecord(interruptedTask, 'running'),
      makeRecord(failedTask, 'failed'),
      makeRecord(localCompletedTask, 'completed'),
      makeRecord(daemonCompletedTask, 'queued'),
    ])
    const getTaskExecution = vi.fn(async (taskId: string) => {
      const task = [interruptedTask, failedTask, daemonCompletedTask].find(
        (candidate) => candidate.id === taskId,
      ) as AiTask
      return makeExecution(
        task,
        taskId === daemonCompletedTask.id
          ? 'completed'
          : taskId === failedTask.id
            ? 'failed'
            : 'interrupted',
      )
    })

    const report = await bootstrapDesktopTaskRecovery({
      projectId,
      store,
      clock: fixedClock,
      getTaskExecution,
    })

    expect(report.records.map((record) => record.task.id)).toEqual([
      'interrupted-task',
      'failed-task',
    ])
    expect(report.recoveredTaskIds).toEqual(['interrupted-task', 'failed-task'])
    expect(report.completedTaskIds).toEqual(['local-completed-task', 'daemon-completed-task'])
    expect(getTaskExecution).not.toHaveBeenCalledWith(localCompletedTask.id)
    expect(store.remove).toHaveBeenCalledTimes(2)
    expect(store.records.map((record) => record.task.id)).toEqual([
      'interrupted-task',
      'failed-task',
    ])
  })

  it('reports a protocol error and preserves the task as interrupted', async () => {
    const task = makeTask('protocol-error-task')
    const store = makeStore([makeRecord(task, 'running')])
    const getTaskExecution = vi.fn(
      async () =>
        ({
          task,
          snapshot: makeSnapshot(task, 'running', { taskId: 'wrong-task-id' }),
          attempts: 1,
          updatedAt: 20,
        }) as unknown as TaskExecutionSnapshot,
    )

    const report = await bootstrapDesktopTaskRecovery({
      projectId,
      store,
      clock: fixedClock,
      getTaskExecution,
    })

    expect(report.issues).toEqual([
      expect.objectContaining({
        taskId: task.id,
        kind: 'protocol',
      }),
    ])
    expect(report.records[0]).toMatchObject({
      task,
      snapshot: {
        status: 'interrupted',
        error: {
          code: 'DESKTOP_TASK_RECOVERY_PROTOCOL_ERROR',
        },
      },
      updatedAt: 500,
    })
    expect(store.records[0].snapshot.status).toBe('interrupted')
  })
})
