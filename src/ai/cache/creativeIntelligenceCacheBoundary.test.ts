import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { LayeredContextCache } from './index'
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

describe('Desktop cache wiring boundary', () => {
  it('records only provider-layer calls made by CreativeIntelligence', async () => {
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
    const cache = new LayeredContextCache<TaskResult>({ maxEntries: 2 })
    const intelligence = new CreativeIntelligence(gateway, { cache: cache.provider })

    await intelligence.run(makeTask('task-1'), { pollIntervalMs: 0 })
    await intelligence.run(makeTask('task-2'), { pollIntervalMs: 0 })

    expect(submitted).toHaveLength(1)
    expect(cache.stats('context')).toMatchObject({ hits: 0, misses: 0, evictions: 0 })
    expect(cache.stats('semantic')).toMatchObject({ hits: 0, misses: 0, evictions: 0 })
    expect(cache.stats('provider')).toMatchObject({ hits: 1, misses: 1, evictions: 0 })
  })
})
