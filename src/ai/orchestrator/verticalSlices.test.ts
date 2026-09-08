import { describe, expect, it } from 'vitest'
import type { SemanticDocument } from '../../domain/content'
import {
  ContinuityAuditScheduler,
  CreativeIntelligence,
  ProjectDistillationWorkflow,
  type ProjectDistillationInput,
} from '../index'

const documents = ['d1', 'd2', 'd3'].map((documentId, index) => ({
  documentId,
  revision: index + 1,
  text: `章节 ${index + 1}`,
  blocks: [{ id: `${documentId}-block`, type: 'paragraph', text: `章节 ${index + 1}`, from: 0, to: 4 }],
  sourceMap: {},
  representation: 'text',
})) as unknown as SemanticDocument[]

function makeGateway(failTaskIds: Set<string> = new Set()) {
  const submitted = new Set<string>()
  return {
    submitTask: async (task: { id: string }) => {
      submitted.add(task.id)
      return { taskId: task.id, status: 'queued' as const }
    },
    getTaskStatus: async (taskId: string) => ({
      taskId,
      kind: taskId.includes('chunk') ? 'narrative.project.distill' : 'narrative.continuity.audit',
      status: failTaskIds.has(taskId) ? 'failed' as const : 'completed' as const,
      result: failTaskIds.has(taskId)
        ? { taskId, kind: 'narrative.project.distill', status: 'failed' as const, error: { code: 'TEST', message: 'temporary' } }
        : taskId.includes('chunk')
          ? {
              taskId,
              kind: 'narrative.project.distill',
              status: 'completed' as const,
              output: { format: 'structured' as const, data: { summary: taskId, entities: [], events: [], promises: [] } },
            }
          : {
              taskId,
              kind: 'narrative.continuity.audit',
              status: 'completed' as const,
              output: { format: 'structured' as const, data: [{ severity: 'warning', description: '发现冲突' }] },
            },
    }),
    cancelTask: async (taskId: string) => ({ taskId, cancelled: true, status: 'cancelled' as const }),
    submitted,
    failTaskIds,
  }
}

describe('vertical slice orchestration', () => {
  it('debounces and deduplicates continuity audits while allowing cancellation', async () => {
    const gateway = makeGateway()
    const scheduler = new ContinuityAuditScheduler(new CreativeIntelligence(gateway), { debounceMs: 0 })
    const input = { taskId: 'audit-1', document: documents[0], scope: 'document' as const }
    const first = scheduler.schedule(input, { pollIntervalMs: 0 })
    const duplicate = scheduler.schedule(input, { pollIntervalMs: 0 })
    await expect(first).resolves.toHaveLength(1)
    await expect(duplicate).resolves.toHaveLength(1)
    expect(scheduler.pendingCount()).toBe(0)
    expect(gateway.submitted.size).toBe(1)

    const pending = scheduler.schedule({ ...input, taskId: 'audit-cancelled', document: documents[1] })
    expect(scheduler.cancel(documents[1].documentId)).toBe(true)
    await expect(pending).rejects.toThrow(/cancelled|superseded/i)
  })

  it('maps project distillation into chunks, checkpoints progress, and retries failed chunks', async () => {
    const failedTaskId = 'distill:chunk:1'
    const gateway = makeGateway(new Set([failedTaskId]))
    const workflow = new ProjectDistillationWorkflow(new CreativeIntelligence(gateway))
    const input: ProjectDistillationInput = { taskId: 'distill', documents }
    const checkpoints: Array<{ nextChunk: number; failedChunks: string[] }> = []
    const first = await workflow.run(input, {
      chunkSize: 2,
      continueOnError: true,
      pollIntervalMs: 0,
      saveCheckpoint: (checkpoint) => checkpoints.push({ nextChunk: checkpoint.nextChunk, failedChunks: checkpoint.failedChunks }),
    })
    expect(first.complete).toBe(false)
    expect(first.completedChunks).toBe(1)
    expect(first.failedChunks).toEqual(['d3:d3'])
    expect(checkpoints.length).toBeGreaterThan(0)

    gateway.failTaskIds?.delete(failedTaskId)
    const resumed = await workflow.run(input, {
      chunkSize: 2,
      checkpoint: first.checkpoint,
      pollIntervalMs: 0,
      saveCheckpoint: (checkpoint) => checkpoints.push({ nextChunk: checkpoint.nextChunk, failedChunks: checkpoint.failedChunks }),
    })
    expect(resumed.complete).toBe(true)
    expect(resumed.completedChunks).toBe(2)
    expect(resumed.chunkTaskIds).toEqual(['distill:chunk:1'])
  })
})
