import type { AiTask, TaskExecutionSnapshot, TaskResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
import type { RpcClient } from '../ports/aiGateway'
import { listPluginInstructionDefinitions } from '../ai/instructions/pluginInstructions'
import { createDaemonAiAssistant } from './daemonAiAssistant'

function task(id: string): AiTask {
  return {
    id,
    kind: 'plugin.demo.analysis',
    input: { text: `input:${id}` },
    outputContract: { format: 'text' },
  }
}

function completedResult(input: AiTask): TaskResult {
  return {
    taskId: input.id,
    kind: input.kind,
    status: 'completed',
    output: { format: 'text', text: `done:${input.id}` },
  }
}

function makeClient(onRegister?: () => Promise<void>): {
  client: RpcClient
  calls: Array<{ method: string; params: unknown }>
  registerCalls: number
} {
  const calls: Array<{ method: string; params: unknown }> = []
  let registerCalls = 0
  const client: RpcClient = {
    request: async <T>(method: string, params?: unknown): Promise<T> => {
      calls.push({ method, params })
      if (method === 'instruction.register') {
        registerCalls += 1
        await onRegister?.()
        return { success: true } as T
      }
      if (method === 'task.submit') {
        return { taskId: (params as { task: AiTask }).task.id, status: 'queued' } as T
      }
      if (method === 'task.status') {
        const input = (params as { taskId: string }).taskId
        return {
          taskId: input,
          kind: 'plugin.demo.analysis',
          status: 'completed',
          result: completedResult(task(input)),
        } as T
      }
      throw new Error(`Unexpected RPC method: ${method}`)
    },
    close: vi.fn(async () => undefined),
  }
  return { client, calls, get registerCalls() { return registerCalls } }
}

describe('createDaemonAiAssistant instruction registration', () => {
  it('registers stable plugin instructions once before the first task', async () => {
    const harness = makeClient()
    const assistant = createDaemonAiAssistant(harness.client)

    await expect(assistant.runTask(task('first'), { pollIntervalMs: 0 })).resolves.toMatchObject({
      output: { text: 'done:first' },
    })
    await expect(assistant.runTask(task('second'), { pollIntervalMs: 0 })).resolves.toMatchObject({
      output: { text: 'done:second' },
    })

    expect(harness.registerCalls).toBe(1)
    expect(harness.calls.map((call) => call.method)).toEqual([
      'instruction.register',
      'task.submit',
      'task.status',
      'task.submit',
      'task.status',
    ])
    const payload = harness.calls.find((call) => call.method === 'instruction.register')
      ?.params as { instructions: Array<Record<string, unknown>> }
    expect(payload.instructions).toEqual([
      ...listCoreInstructionDefinitions(),
      ...listPluginInstructionDefinitions(),
    ])
    expect(
      payload.instructions.every(
        (instruction) =>
          typeof instruction.id === 'string' &&
          typeof instruction.version === 'string' &&
          typeof instruction.systemInstruction === 'string',
      ),
    ).toBe(true)
  })

  it('shares one in-flight registration when first tasks start concurrently', async () => {
    let releaseRegistration!: () => void
    const registrationGate = new Promise<void>((resolve) => {
      releaseRegistration = resolve
    })
    const harness = makeClient(() => registrationGate)
    const assistant = createDaemonAiAssistant(harness.client)

    const first = assistant.runTask(task('parallel-1'), { pollIntervalMs: 0 })
    const second = assistant.runTask(task('parallel-2'), { pollIntervalMs: 0 })
    await vi.waitFor(() => expect(harness.registerCalls).toBe(1))
    expect(harness.calls.filter((call) => call.method === 'task.submit')).toHaveLength(0)

    releaseRegistration()
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(harness.registerCalls).toBe(1)
    expect(harness.calls.filter((call) => call.method === 'task.submit')).toHaveLength(2)
  })

  it('routes completed tasks through capability selection and the deterministic cache', async () => {
    const harness = makeClient()
    const assistant = createDaemonAiAssistant(harness.client)

    const first = await assistant.runTask(task('cached'), { pollIntervalMs: 0 })
    const second = await assistant.runTask(task('cached'), { pollIntervalMs: 0 })

    expect(first?.provenance).toMatchObject({ routeId: 'creative-gateway', cacheHit: false })
    expect(second?.provenance).toMatchObject({ routeId: 'creative-gateway', cacheHit: true })
    expect(harness.calls.filter((call) => call.method === 'task.submit')).toHaveLength(1)
  })

  it('surfaces a network failure during registration and retries the handshake', async () => {
    let attempts = 0
    const harness = makeClient(async () => {
      attempts += 1
      if (attempts === 1) throw new Error('network unavailable')
    })
    const assistant = createDaemonAiAssistant(harness.client)

    await expect(assistant.runTask(task('network-failure'), { pollIntervalMs: 0 })).rejects.toThrow('network unavailable')
    await expect(assistant.runTask(task('network-retry'), { pollIntervalMs: 0 })).resolves.toMatchObject({
      output: { text: 'done:network-retry' },
    })
    expect(harness.registerCalls).toBe(2)
  })

  it('cancels an in-flight task when its caller aborts', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    const client: RpcClient = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params })
        if (method === 'instruction.register') return { success: true } as T
        if (method === 'task.submit') return { taskId: task('cancelled').id, status: 'queued' } as T
        if (method === 'task.status') {
          return {
            taskId: task('cancelled').id,
            kind: task('cancelled').kind,
            status: 'running',
          } as T
        }
        if (method === 'task.cancel') return { taskId: task('cancelled').id, cancelled: true, status: 'cancelled' } as T
        throw new Error(`Unexpected RPC method: ${method}`)
      },
      close: vi.fn(async () => undefined),
    }
    const controller = new AbortController()
    const assistant = createDaemonAiAssistant(client)
    const pending = assistant.runTask(task('cancelled'), { pollIntervalMs: 50, signal: controller.signal })
    await Promise.resolve()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls.map((call) => call.method)).toContain('task.cancel')
  })

  it('reports progress and returns a waiting-user result at the diagnostic boundary', async () => {
    const statuses = [
      { status: 'running' as const, progress: { completed: 1, total: 2 } },
      {
        status: 'waiting-user' as const,
        result: {
          taskId: 'waiting-user',
          kind: 'plugin.demo.analysis',
          status: 'waiting-user' as const,
          output: { format: 'text' as const, text: '需要作者确认' },
        },
      },
    ]
    let statusIndex = 0
    const client: RpcClient = {
      request: async <T>(method: string, _params?: unknown): Promise<T> => {
        if (method === 'instruction.register') return { success: true } as T
        if (method === 'task.submit') return { taskId: 'waiting-user', status: 'queued' } as T
        if (method === 'task.status') return { taskId: 'waiting-user', kind: task('waiting-user').kind, ...statuses[statusIndex++] } as T
        throw new Error(`Unexpected RPC method: ${method}`)
      },
      close: vi.fn(async () => undefined),
    }
    const progress: unknown[] = []
    const assistant = createDaemonAiAssistant(client)

    await expect(assistant.runTask(task('waiting-user'), { pollIntervalMs: 0, onProgress: (snapshot) => progress.push(snapshot) })).resolves.toMatchObject({
      status: 'waiting-user',
      output: { text: '需要作者确认' },
    })
    expect(progress).toHaveLength(2)
    expect(progress[0]).toMatchObject({ status: 'running', progress: { completed: 1 } })
  })

  it('forwards steering and checkpoint resume requests', async () => {
    const calls: string[] = []
    const client: RpcClient = {
      request: async <T>(method: string): Promise<T> => {
        calls.push(method)
        if (method === 'task.steer') return { accepted: true } as T
        if (method === 'task.resume') return { taskId: 'task-1', status: 'queued' } as T
        throw new Error(`Unexpected RPC method: ${method}`)
      },
      close: vi.fn(async () => undefined),
    }
    const assistant = createDaemonAiAssistant(client)
    await expect(assistant.steerTask?.('task-1', { direction: '收束' })).resolves.toBe(true)
    await expect(assistant.resumeTask?.('task-1')).resolves.toBeUndefined()
    expect(calls).toEqual(['task.steer', 'task.resume'])
  })

  it('exposes the durable task execution view through the semantic assistant port', async () => {
    const execution: TaskExecutionSnapshot = {
      task: task('execution-view'),
      snapshot: {
        taskId: 'execution-view',
        kind: 'plugin.demo.analysis',
        status: 'checkpointed',
        checkpoint: { step: 'draft', updatedAt: 42 },
      },
      attempts: 2,
      updatedAt: 42,
      steps: [
        {
          id: 'step-1',
          runId: 'run-1',
          step: 'draft',
          status: 'checkpointed',
        },
      ],
      resumeToken: {
        taskId: 'execution-view',
        checkpointStep: 'draft',
        issuedAt: 42,
      },
    }
    const calls: Array<{ method: string; params: unknown }> = []
    const client: RpcClient = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params })
        if (method === 'task.execution') return execution as T
        throw new Error(`Unexpected RPC method: ${method}`)
      },
      close: vi.fn(async () => undefined),
    }
    const assistant = createDaemonAiAssistant(client)

    await expect(assistant.getTaskExecution?.('execution-view')).resolves.toEqual(execution)
    expect(calls).toEqual([{ method: 'task.execution', params: { taskId: 'execution-view' } }])
  })
})
