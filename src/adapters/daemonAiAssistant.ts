import type { AiTask, TaskResult, TaskStatusSnapshot, TaskSubmitResult } from '@inkpi/protocol'
import type { AiAssistant, RpcClient } from '../ports/aiGateway'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
import { listPluginInstructionDefinitions } from '../ai/instructions/pluginInstructions'

/**
 * 把底层 RpcClient（字符串方法 JSON-RPC）封装成语义化 AiAssistant。
 * 传输层方法名集中在此处，视图层 / 根组件不再出现 'session.create' 等字符串（§14.4）。
 */
export const createDaemonAiAssistant = (client: RpcClient): AiAssistant => {
  let pluginInstructionsReady: Promise<void> | undefined

  const ensurePluginInstructionsRegistered = (): Promise<void> => {
    if (!pluginInstructionsReady) {
      pluginInstructionsReady = (async () => {
        await client.request('instruction.register', {
          instructions: [
            ...listCoreInstructionDefinitions(),
            ...listPluginInstructionDefinitions(),
          ],
        })
      })().catch((error) => {
        // A failed first handshake must be retryable, while concurrent callers
        // still share the same in-flight registration promise.
        pluginInstructionsReady = undefined
        throw error
      })
    }
    return pluginInstructionsReady
  }

  return {
    runTask: async (task: AiTask, options = {}): Promise<TaskResult | null> => {
      await ensurePluginInstructionsRegistered()
      await client.request<TaskSubmitResult>('task.submit', { task })
      const pollIntervalMs = options.pollIntervalMs ?? 100
      while (true) {
        if (options.signal?.aborted) {
          await client.request('task.cancel', { taskId: task.id }).catch(() => undefined)
          throw abortError()
        }
        const status = await client.request<TaskStatusSnapshot>('task.status', { taskId: task.id })
        options.onProgress?.(status)
        if (['waiting-user', 'completed', 'failed', 'cancelled'].includes(status.status)) {
          return status.result || null
        }
        await delay(pollIntervalMs, options.signal)
      }
    },

    steerTask: async (taskId: string, input: unknown): Promise<boolean> => {
      const result = await client.request<{ accepted: boolean }>('task.steer', { taskId, input })
      return result.accepted
    },

    resumeTask: async (taskId: string): Promise<void> => {
      await client.request('task.resume', { taskId })
    },

    status: () => client.request<{ running: boolean }>('daemon.status'),

    close: () => client.close(),
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, Math.max(0, ms))
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })
}

function abortError(): Error {
  const error = new Error('Creative task was cancelled')
  error.name = 'AbortError'
  return error
}
