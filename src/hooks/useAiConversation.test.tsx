import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskStatusSnapshot } from '@inkpi/protocol'
import type { AiAssistant } from '../ports/aiGateway'
import type { Clock } from '../ports/clock'
import type { TaskRecoveryRecord, TaskRecoveryStore } from '../db/taskRecoveryStore'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import { useAiConversation } from './useAiConversation'

const { connectToDaemon } = vi.hoisted(() => ({ connectToDaemon: vi.fn() }))

vi.mock('../core/daemonConnection', () => ({ connectToDaemon }))
vi.mock('../adapters/inkpiDaemonGateway', () => ({ inkpiDaemonGateway: {} }))

const makeTask = (id: string): AiTask => ({
  id,
  kind: 'creative.continue',
  input: { documentId: 'chapter-1', text: '片段' },
})

const makeSnapshot = (task: AiTask, status: TaskStatusSnapshot['status']): TaskStatusSnapshot => ({
  taskId: task.id,
  kind: task.kind,
  status,
})

function makeStore(initial: TaskRecoveryRecord[] = []): TaskRecoveryStore & { records: Map<string, TaskRecoveryRecord> } {
  const records = new Map(initial.map((record) => [record.task.id, record]))
  return {
    records,
    list: vi.fn(async () => [...records.values()]),
    save: vi.fn(async (record: TaskRecoveryRecord) => {
      records.set(record.task.id, record)
    }),
    remove: vi.fn(async (_projectId: string, taskId: string) => {
      records.delete(taskId)
    }),
  }
}

function makeAssistant(runTask: AiAssistant['runTask']): AiAssistant {
  return {
    runTask,
    resumeTask: vi.fn(async () => undefined),
    status: vi.fn(async () => ({ running: true })),
    close: vi.fn(async () => undefined),
  }
}

const fixedClock: Clock = { now: () => 100 }

beforeEach(() => {
  connectToDaemon.mockReset()
})

describe('useAiConversation task recovery', () => {
  it('rehydrates a task after restart and sends the existing task.resume RPC', async () => {
    const task = makeTask('restart-task')
    const store = makeStore([{
      projectId: 'project-1',
      task,
      snapshot: {
        ...makeSnapshot(task, 'running'),
        checkpoint: { step: 'chapter-2', updatedAt: 50 },
      },
      updatedAt: 50,
    }])
    const assistant = makeAssistant(vi.fn(async () => null))
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })

    const hook = renderHook(() => useAiConversation('ws://daemon', null, 'project-1', {
      taskRecoveryStore: store,
      clock: fixedClock,
    }))

    await waitFor(() => expect(hook.result.current.taskRecovery).toHaveLength(1))
    expect(hook.result.current.taskRecovery[0].snapshot.status).toBe('interrupted')
    expect(hook.result.current.taskRecovery[0].snapshot.checkpoint?.step).toBe('chapter-2')

    await act(async () => {
      await expect(hook.result.current.resumeTask(task.id)).resolves.toBe(true)
    })

    expect(assistant.resumeTask).toHaveBeenCalledWith(task.id)
    expect(hook.result.current.taskRecovery[0].snapshot.status).toBe('queued')
    expect(store.records.get(task.id)?.snapshot.status).toBe('queued')
    hook.unmount()
  })

  it('persists a failed snapshot when the daemon task fails', async () => {
    const task = makeTask('failed-task')
    const store = makeStore()
    const runTask = vi.fn(async (_task: AiTask, options?: Parameters<AiAssistant['runTask']>[1]) => {
      options?.onProgress?.({ ...makeSnapshot(task, 'running'), progress: 0.25 })
      throw new Error('provider failed')
    })
    const assistant = makeAssistant(runTask)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() => useAiConversation('ws://daemon', null, 'project-1', {
      taskRecoveryStore: store,
      clock: fixedClock,
    }))
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    await expect(hook.result.current.runAiTask(task)).rejects.toThrow('provider failed')
    await waitFor(() => expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('failed'))
    expect(hook.result.current.taskRecovery[0].snapshot.error).toMatchObject({ message: 'provider failed' })
    expect(store.records.get(task.id)?.snapshot.status).toBe('failed')
    hook.unmount()
  })

  it('cancels an active task through its AbortSignal and records cancellation', async () => {
    const task = makeTask('cancelled-task')
    const store = makeStore()
    const runTask = vi.fn(async (_task: AiTask, options?: Parameters<AiAssistant['runTask']>[1]) => {
      options?.onProgress?.(makeSnapshot(task, 'running'))
      return new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    })
    const assistant = makeAssistant(runTask)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() => useAiConversation('ws://daemon', null, 'project-1', {
      taskRecoveryStore: store,
      clock: fixedClock,
    }))
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    let pending!: Promise<unknown>
    await act(async () => {
      pending = hook.result.current.runAiTask(task)
      pending.catch(() => undefined)
      await waitFor(() => expect(runTask).toHaveBeenCalled())
      await expect(hook.result.current.cancelTask(task.id)).resolves.toBe(true)
    })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await waitFor(() => expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('cancelled'))
    expect(store.records.get(task.id)?.snapshot.status).toBe('cancelled')
    hook.unmount()
  })

  it('synchronizes a local domain append after a short debounce', async () => {
    const syncDomain = vi.fn(async () => ({
      workspaceId: 'project-1',
      pushed: 1,
      pulled: 0,
      revision: 1,
      recovered: false,
    }))
    const assistant = {
      ...makeAssistant(vi.fn(async () => null)),
      syncDomain,
    } satisfies AiAssistant
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() => useAiConversation('ws://daemon', null, 'project-1', {
      taskRecoveryStore: makeStore(),
      clock: fixedClock,
    }))

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await waitFor(() => expect(syncDomain).toHaveBeenCalledWith('project-1'))
    syncDomain.mockClear()

    act(() => {
      domainChangeEvents.publish('project-1')
      domainChangeEvents.publish('project-1')
    })

    await waitFor(() => expect(syncDomain).toHaveBeenCalledOnce(), { timeout: 3000 })
    expect(syncDomain).toHaveBeenCalledWith('project-1')
    hook.unmount()
  })
})
