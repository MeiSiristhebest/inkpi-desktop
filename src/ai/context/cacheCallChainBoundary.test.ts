import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { LayeredContextCache, SharedCacheMetrics } from '../cache'
import { CreativeIntelligence } from '../orchestrator/creativeIntelligence'

function makeTask(id: string): AiTask {
  return {
    id,
    kind: 'creative.continue',
    input: {
      documentId: 'document-1',
      selection: { documentId: 'document-1', from: 0, to: 4, revision: 1 },
      text: 'stable input',
      payload: { context: { fingerprint: 'context-1' } },
    },
    intent: 'continue',
    outputContract: { format: 'text' },
  }
}

describe('Desktop cache call-chain boundary', () => {
  it('proves CreativeIntelligence currently reaches only the provider layer', async () => {
    const submitted: AiTask[] = []
    const gateway = {
      submitTask: vi.fn(async (task: AiTask) => {
        submitted.push(task)
        return { taskId: task.id, status: 'queued' as const }
      }),
      cancelTask: vi.fn(async (taskId: string) => ({
        taskId,
        cancelled: true,
        status: 'cancelled' as const,
      })),
      getTaskStatus: vi.fn(async (taskId: string) => ({
        taskId,
        kind: 'creative.continue',
        status: 'completed' as const,
        result: {
          taskId,
          kind: 'creative.continue',
          status: 'completed' as const,
          output: { format: 'text' as const, text: 'cached response' },
        },
      })),
    }
    const layered = new LayeredContextCache<TaskResult>({ maxEntries: 2 })
    const metrics = new SharedCacheMetrics()
    const intelligence = new CreativeIntelligence(gateway, {
      cache: layered.provider,
      cacheMetrics: metrics,
    })

    await intelligence.run(makeTask('task-1'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('task-2'), { pollIntervalMs: 0 })

    expect(submitted).toHaveLength(1)
    expect(layered.stats('context')).toMatchObject({ hits: 0, misses: 0 })
    expect(layered.stats('semantic')).toMatchObject({ hits: 0, misses: 0 })
    expect(layered.stats('provider')).toMatchObject({ hits: 1, misses: 1 })
    expect(intelligence.cacheStats()).toMatchObject({ hits: 1, misses: 1 })
  })

  it('captures the compile-time seam that prevents passing all three layers today', () => {
    const gateway = {
      submitTask: async () => ({ taskId: 'task', status: 'queued' as const }),
      cancelTask: async (taskId: string) => ({
        taskId,
        cancelled: true,
        status: 'cancelled' as const,
      }),
      getTaskStatus: async () => ({
        taskId: 'task',
        kind: 'creative.continue',
        status: 'completed' as const,
        result: {
          taskId: 'task',
          kind: 'creative.continue',
          status: 'completed' as const,
          output: { format: 'text' as const, text: 'done' },
        },
      }),
    }
    const layered = new LayeredContextCache<TaskResult>()

    // @ts-expect-error CreativeIntelligence currently accepts one ContextCache, not LayeredContextCache.
    new CreativeIntelligence(gateway, { cache: layered })

    expect(layered.stats()).toMatchObject({
      context: { hits: 0, misses: 0 },
      semantic: { hits: 0, misses: 0 },
      provider: { hits: 0, misses: 0 },
    })
  })
})
