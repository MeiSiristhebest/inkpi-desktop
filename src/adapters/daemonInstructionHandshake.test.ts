import type { AiTask, TaskResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
import {
  listPluginInstructionDefinitions,
  type DesktopInstructionDefinition,
} from '../ai/instructions/pluginInstructions'
import type { RpcClient } from '../ports/aiGateway'
import { createDaemonAiAssistant } from './daemonAiAssistant'

function makeTask(id: string): AiTask {
  return {
    id,
    kind: 'creative.assistant',
    input: { text: 'handshake test' },
    outputContract: { format: 'text' },
  }
}

function completedResult(task: AiTask): TaskResult {
  return {
    taskId: task.id,
    kind: task.kind,
    status: 'completed',
    output: { format: 'text', text: 'ok' },
  }
}

function registrationResult(
  instructions: readonly DesktopInstructionDefinition[],
): Record<string, unknown> {
  return {
    success: true,
    registered: true,
    count: instructions.length,
    instructionIds: instructions.map((instruction) => instruction.id),
    added: instructions.map((instruction) => instruction.id),
    updated: [],
    unchanged: [],
    results: instructions.map((instruction) => ({
      id: instruction.id,
      version: instruction.version,
      status: 'added',
    })),
    version: 'instructions-1',
  }
}

function clientWithReceipt(receipt: unknown): RpcClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    request: async <T>(method: string, params?: unknown): Promise<T> => {
      calls.push(method)
      if (method === 'instruction.register') return receipt as T
      if (method === 'task.submit') {
        const task = (params as { task: AiTask }).task
        return { taskId: task.id, status: 'queued' } as T
      }
      if (method === 'task.status') {
        const taskId = (params as { taskId: string }).taskId
        return {
          taskId,
          kind: 'creative.assistant',
          status: 'completed',
          result: completedResult(makeTask(taskId)),
        } as T
      }
      throw new Error(`Unexpected RPC method: ${method}`)
    },
    close: vi.fn(async () => undefined),
  }
}

describe('Desktop instruction registration handshake', () => {
  it('accepts and validates the Daemon registration receipt', async () => {
    const definitions = [...listCoreInstructionDefinitions(), ...listPluginInstructionDefinitions()]
    const client = clientWithReceipt(registrationResult(definitions))
    const assistant = createDaemonAiAssistant(client)

    await expect(assistant.runTask(makeTask('handshake-ok'), { pollIntervalMs: 0 })).resolves.toMatchObject({
      output: { text: 'ok' },
    })
    expect(client.calls).toEqual(['instruction.register', 'task.submit', 'task.status'])
  })

  it('rejects a receipt whose catalog IDs do not match the Desktop definitions', async () => {
    const definitions = [...listCoreInstructionDefinitions(), ...listPluginInstructionDefinitions()]
    const receipt = registrationResult(definitions)
    receipt.instructionIds = ['wrong-instruction']
    const client = clientWithReceipt(receipt)
    const assistant = createDaemonAiAssistant(client)

    await expect(assistant.runTask(makeTask('handshake-bad'), { pollIntervalMs: 0 })).rejects.toThrow(
      'registration IDs do not match',
    )
    expect(client.calls).toEqual(['instruction.register'])
  })
})
