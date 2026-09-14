import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskStatusSnapshot } from '@inkpi/protocol'
import type { AiAssistant } from '../ports/aiGateway'
import type { Clock } from '../ports/clock'
import type { TaskRecoveryRecord, TaskRecoveryStore } from '../db/taskRecoveryStore'
import { createStoryState } from '../domain/story'
import { semanticDocumentFromText } from '../domain/content'
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

function makeStore(
  initial: TaskRecoveryRecord[] = [],
): TaskRecoveryStore & { records: Map<string, TaskRecoveryRecord> } {
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
  it('includes the authoritative StoryState in default creative task context', async () => {
    const store = makeStore()
    const storyState = createStoryState(7)
    let submitted: AiTask | undefined
    const runTask = vi.fn(async (task: AiTask) => {
      submitted = task
      return {
        taskId: task.id,
        kind: task.kind,
        status: 'completed' as const,
        output: { format: 'text' as const, text: '续写结果' },
      }
    })
    const assistant = makeAssistant(runTask)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
        storyState,
      }),
    )

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await act(async () => {
      await expect(hook.result.current.requestGhost('chapter-1', '已有内容')).resolves.toBe(
        '续写结果',
      )
    })

    expect(submitted).toMatchObject({
      kind: 'creative.continue',
      contextPolicy: {
        includeProjectState: true,
        providerIds: expect.arrayContaining(['creative.story']),
      },
      input: {
        payload: {
          context: {
            storyContext: expect.objectContaining({ revision: 7 }),
          },
        },
      },
    })
    hook.unmount()
  })

  it('rehydrates a task after restart and sends the existing task.resume RPC', async () => {
    const task = makeTask('restart-task')
    const store = makeStore([
      {
        projectId: 'project-1',
        task,
        snapshot: {
          ...makeSnapshot(task, 'running'),
          checkpoint: { step: 'chapter-2', updatedAt: 50 },
        },
        updatedAt: 50,
      },
    ])
    const assistant = makeAssistant(vi.fn(async () => null))
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })

    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

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

  it('closes the previous daemon assistant when reconnect replaces it', async () => {
    const first = makeAssistant(vi.fn(async () => null))
    const second = makeAssistant(vi.fn(async () => null))
    const store = makeStore()
    connectToDaemon
      .mockResolvedValueOnce({ client: first, connected: true })
      .mockResolvedValueOnce({ client: second, connected: true })

    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await act(async () => {
      hook.result.current.reconnect()
      await waitFor(() => expect(connectToDaemon).toHaveBeenCalledTimes(2))
    })
    await waitFor(() => expect(first.close).toHaveBeenCalledOnce())

    hook.unmount()
    expect(second.close).toHaveBeenCalledOnce()
  })

  it('updates connection state after an async disconnect, restores it on reconnect, and cleans up listeners', async () => {
    const first = makeAssistant(vi.fn(async () => null))
    const second = makeAssistant(vi.fn(async () => null))
    const firstListeners = new Set<(connected: boolean) => void>()
    const secondListeners = new Set<(connected: boolean) => void>()
    const firstUnsubscribe = vi.fn(() => firstListeners.clear())
    const secondUnsubscribe = vi.fn(() => secondListeners.clear())
    Object.assign(first, {
      subscribeToConnectionState: (listener: (connected: boolean) => void) => {
        firstListeners.add(listener)
        return firstUnsubscribe
      },
    })
    Object.assign(second, {
      subscribeToConnectionState: (listener: (connected: boolean) => void) => {
        secondListeners.add(listener)
        return secondUnsubscribe
      },
    })
    connectToDaemon
      .mockResolvedValueOnce({ client: first, connected: true })
      .mockResolvedValueOnce({ client: second, connected: true })

    const hook = renderHook(() => useAiConversation('ws://daemon', null))
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    expect(firstListeners.size).toBe(1)

    act(() => {
      for (const listener of firstListeners) listener(false)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(false))
    expect(firstUnsubscribe).toHaveBeenCalledOnce()

    act(() => {
      hook.result.current.reconnect()
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    expect(secondListeners.size).toBe(1)

    hook.unmount()
    expect(secondUnsubscribe).toHaveBeenCalledOnce()
    expect(second.close).toHaveBeenCalledOnce()
  })

  it('persists a failed snapshot when the daemon task fails', async () => {
    const task = makeTask('failed-task')
    const store = makeStore()
    const runTask = vi.fn(
      async (_task: AiTask, options?: Parameters<AiAssistant['runTask']>[1]) => {
        options?.onProgress?.({ ...makeSnapshot(task, 'running'), progress: 0.25 })
        throw new Error('provider failed')
      },
    )
    const assistant = makeAssistant(runTask)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    await expect(hook.result.current.runAiTask(task)).rejects.toThrow('provider failed')
    await waitFor(() => expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('failed'))
    expect(hook.result.current.taskRecovery[0].snapshot.error).toMatchObject({
      message: 'provider failed',
    })
    expect(store.records.get(task.id)?.snapshot.status).toBe('failed')
    hook.unmount()
  })

  it('serializes recovery writes so a completed task cannot be resurrected by a late save', async () => {
    const task = makeTask('late-save-task')
    const records = new Map<string, TaskRecoveryRecord>()
    const operationOrder: string[] = []
    let releaseSave!: () => void
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const store: TaskRecoveryStore & { records: Map<string, TaskRecoveryRecord> } = {
      records,
      list: vi.fn(async () => []),
      save: vi.fn(async (record: TaskRecoveryRecord) => {
        operationOrder.push('save')
        await saveGate
        records.set(record.task.id, record)
      }),
      remove: vi.fn(async (_projectId: string, taskId: string) => {
        operationOrder.push('remove')
        records.delete(taskId)
      }),
    }
    const assistant = makeAssistant(
      vi.fn(async () => ({
        taskId: task.id,
        kind: task.kind,
        status: 'completed' as const,
        output: { format: 'text' as const, text: 'done' },
      })),
    )
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await act(async () => {
      await expect(hook.result.current.runAiTask(task)).resolves.toMatchObject({
        status: 'completed',
      })
    })
    await waitFor(() => expect(store.save).toHaveBeenCalledOnce())
    releaseSave()
    await waitFor(() => expect(store.remove).toHaveBeenCalledOnce())

    expect(operationOrder).toEqual(['save', 'remove'])
    expect(store.records.has(task.id)).toBe(false)
    hook.unmount()
  })

  it('tracks convenience vertical-slice tasks in the same recovery store', async () => {
    const taskId = 'deep-reasoning-recovery-task'
    const store = makeStore()
    const runDeepReasoning = vi.fn(
      async (
        _input: Parameters<NonNullable<AiAssistant['runDeepReasoning']>>[0],
        options?: Parameters<NonNullable<AiAssistant['runDeepReasoning']>>[1],
      ) => {
        options?.onProgress?.({
          taskId,
          kind: 'narrative.deep.reason',
          status: 'running',
          progress: 0.5,
        })
        return { answer: 'answer', assumptions: [], alternatives: [], risks: [] }
      },
    )
    const assistant = {
      ...makeAssistant(vi.fn(async () => null)),
      runDeepReasoning,
    } satisfies AiAssistant
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await act(async () => {
      await expect(
        hook.result.current.runDeepReasoning({
          taskId,
          document: semanticDocumentFromText('chapter-1', '正文', 1),
          question: '为什么？',
        }),
      ).resolves.toMatchObject({ answer: 'answer' })
    })

    expect(runDeepReasoning).toHaveBeenCalledOnce()
    await waitFor(() => expect(hook.result.current.taskRecovery).toEqual([]))
    await expect(store.list('project-1')).resolves.toEqual([])
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({ id: taskId, kind: 'narrative.deep.reason' }),
        snapshot: expect.objectContaining({ status: 'running', progress: 0.5 }),
      }),
    )
    hook.unmount()
  })

  it('cancels an active task through its AbortSignal and records cancellation', async () => {
    const task = makeTask('cancelled-task')
    const store = makeStore()
    const runTask = vi.fn(
      async (_task: AiTask, options?: Parameters<AiAssistant['runTask']>[1]) => {
        options?.onProgress?.(makeSnapshot(task, 'running'))
        return new Promise<never>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted')
              error.name = 'AbortError'
              reject(error)
            },
            { once: true },
          )
        })
      },
    )
    const assistant = makeAssistant(runTask)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    let pending!: Promise<unknown>
    await act(async () => {
      pending = hook.result.current.runAiTask(task)
      pending.catch(() => undefined)
      await waitFor(() => expect(runTask).toHaveBeenCalled())
      await expect(hook.result.current.cancelTask(task.id)).resolves.toBe(true)
    })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await waitFor(() =>
      expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('cancelled'),
    )
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
    const store = makeStore()
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, 'project-1', {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

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
