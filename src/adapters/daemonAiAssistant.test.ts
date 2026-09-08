import type { AiTask, TaskResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../ports/aiGateway'
import { listPluginInstructionDefinitions } from '../ai/instructions/pluginInstructions'
import { createDaemonAiAssistant } from './daemonAiAssistant'

function task(id: string): AiTask {
  return {
    id,
    kind: 'plugin.demo.analysis',
    input: { text: 'input' },
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
    const payload = harness.calls[0].params as { instructions: Array<Record<string, unknown>> }
    expect(payload.instructions).toEqual(listPluginInstructionDefinitions())
    expect(payload.instructions.every((instruction) =>
      typeof instruction.id === 'string'
      && typeof instruction.version === 'string'
      && typeof instruction.systemInstruction === 'string',
    )).toBe(true)
  })

  it('shares one in-flight registration when first tasks start concurrently', async () => {
    let releaseRegistration!: () => void
    const registrationGate = new Promise<void>((resolve) => { releaseRegistration = resolve })
    const harness = makeClient(() => registrationGate)
    const assistant = createDaemonAiAssistant(harness.client)

    const first = assistant.runTask(task('parallel-1'), { pollIntervalMs: 0 })
    const second = assistant.runTask(task('parallel-2'), { pollIntervalMs: 0 })
    await Promise.resolve()
    expect(harness.registerCalls).toBe(1)
    expect(harness.calls.filter((call) => call.method === 'task.submit')).toHaveLength(0)

    releaseRegistration()
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(harness.registerCalls).toBe(1)
    expect(harness.calls.filter((call) => call.method === 'task.submit')).toHaveLength(2)
  })
})
