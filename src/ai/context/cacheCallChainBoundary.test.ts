import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { LayeredContextCache, SharedCacheMetrics } from '../cache'
import { CreativeIntelligence } from '../orchestrator/creativeIntelligence'

function makeTask(id: string, revision = 1): AiTask {
  return {
    id,
    kind: 'creative.continue',
    input: {
      documentId: 'document-1',
      selection: { documentId: 'document-1', from: 0, to: 4, revision },
      text: 'stable input',
      payload: { context: { fingerprint: `context-${revision}` } },
    },
    intent: 'continue',
    outputContract: { format: 'text' },
  }
}

describe('Desktop cache call-chain boundary', () => {
  it('routes context, semantic, and provider requests through a shared layered cache', async () => {
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
          output: { format: 'text' as const, text: 'layered response' },
        },
      })),
    }
    const layered = new LayeredContextCache<unknown>({ maxEntries: 2 })
    const intelligence = new CreativeIntelligence(gateway, { layeredCache: layered })

    await intelligence.run(makeTask('layered-1'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('layered-2'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('layered-3', 2), { pollIntervalMs: 0 })

    expect(submitted).toHaveLength(2)
    expect(layered.stats('context')).toMatchObject({ hits: 1, misses: 2, invalidations: 1 })
    expect(layered.stats('semantic')).toMatchObject({ hits: 1, misses: 2, invalidations: 1 })
    expect(layered.stats('provider')).toMatchObject({ hits: 1, misses: 2, invalidations: 1 })
    expect(intelligence.cacheStats()).toMatchObject({ hits: 3, misses: 6, invalidations: 3 })
  })

  it('uses the layered cache by default on the production constructor path', async () => {
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
          output: { format: 'text' as const, text: 'default layered response' },
        },
      })),
    }
    const intelligence = new CreativeIntelligence(gateway)

    await intelligence.run(makeTask('default-1'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('default-2'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('default-3', 2), { pollIntervalMs: 0 })

    expect(submitted).toHaveLength(2)
    expect(intelligence.cacheStats()).toEqual({
      hits: 3,
      misses: 6,
      evictions: 0,
      invalidations: 3,
    })
  })

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

  it('accepts a layered cache through the compatibility cache option', async () => {
    const gateway = {
      submitTask: vi.fn(async (task: AiTask) => ({ taskId: task.id, status: 'queued' as const })),
      cancelTask: async (taskId: string) => ({
        taskId,
        cancelled: true,
        status: 'cancelled' as const,
      }),
      getTaskStatus: async (taskId: string) => ({
        taskId,
        kind: 'creative.continue',
        status: 'completed' as const,
        result: {
          taskId,
          kind: 'creative.continue',
          status: 'completed' as const,
          output: { format: 'text' as const, text: 'done' },
        },
      }),
    }
    const layered = new LayeredContextCache<TaskResult>()
    const intelligence = new CreativeIntelligence(gateway, { cache: layered })

    await intelligence.run(makeTask('compat-layered-1'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('compat-layered-2'), { pollIntervalMs: 0 })

    expect(gateway.submitTask).toHaveBeenCalledTimes(1)
    expect(layered.stats()).toMatchObject({
      context: { hits: 1, misses: 1 },
      semantic: { hits: 1, misses: 1 },
      provider: { hits: 1, misses: 1 },
    })
  })
})
