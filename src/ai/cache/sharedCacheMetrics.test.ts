import { describe, expect, it, vi } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import {
  ContextCache,
  SharedCacheMetrics,
  createSharedCacheMetrics,
} from './index'
import { CreativeIntelligence } from '../orchestrator/creativeIntelligence'

function makeTask(id: string, revision: number): AiTask {
  return {
    id,
    kind: 'creative.continue',
    input: {
      documentId: 'document-1',
      selection: { documentId: 'document-1', from: 0, to: 4, revision },
      text: 'stable input',
      payload: { context: { fingerprint: 'context-1' } },
    },
    intent: 'continue',
    outputContract: { format: 'text' },
  }
}

describe('shared provider-response cache metrics', () => {
  it('counts the shared cache events without retaining cache data', () => {
    const metrics = createSharedCacheMetrics()

    metrics.record('hit')
    metrics.record('miss', 2)
    metrics.record('eviction')
    metrics.record('invalidation')

    expect(metrics.stats()).toEqual({ hits: 1, misses: 2, evictions: 1, invalidations: 1 })
    expect(metrics.snapshot()).toEqual(metrics.stats())
    expect(JSON.stringify(metrics.stats())).not.toContain('prompt')
    expect(JSON.stringify(metrics.stats())).not.toContain('think')

    const snapshot = metrics.stats()
    snapshot.hits = 99
    expect(metrics.stats().hits).toBe(1)

    metrics.reset()
    expect(metrics.stats()).toEqual({ hits: 0, misses: 0, evictions: 0, invalidations: 0 })
  })

  it('records local hits, misses, revision invalidation, and LRU eviction', async () => {
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
    const cache = new ContextCache({ maxEntries: 1 })
    const metrics = new SharedCacheMetrics()
    const intelligence = new CreativeIntelligence(gateway, { cache, cacheMetrics: metrics })

    await intelligence.run(makeTask('task-1', 1), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('task-2', 1), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('task-3', 2), { pollIntervalMs: 0 })

    expect(submitted).toHaveLength(2)
    expect(intelligence.cacheStats()).toEqual({
      hits: 1,
      misses: 2,
      evictions: 1,
      invalidations: 1,
    })
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 2, evictions: 1 })
  })
})
