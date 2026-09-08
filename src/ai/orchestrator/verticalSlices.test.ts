import { describe, expect, it } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import type { SemanticDocument } from '../../domain/content'
import {
  ContinuityAuditScheduler,
  CreativeIntelligence,
  ProjectDistillationWorkflow,
  type AiArtifact,
  type ArtifactStore,
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

function makeSliceGateway() {
  const tasks = new Map<string, AiTask>()
  const submitted: AiTask[] = []
  const steered: Array<{ taskId: string; input: unknown }> = []
  return {
    submitTask: async (task: AiTask) => {
      tasks.set(task.id, task)
      submitted.push(task)
      return { taskId: task.id, status: 'queued' as const }
    },
    getTaskStatus: async (taskId: string) => {
      const task = tasks.get(taskId)
      if (!task) throw new Error(`Unknown task ${taskId}`)
      let output: TaskResult['output']
      switch (task.kind) {
        case 'creative.continue':
          output = { format: 'text', text: '续写结果' }
          break
        case 'creative.rewrite':
          output = { format: 'patch', patch: { from: 1, to: 3, text: '改写结果' } }
          break
        case 'narrative.continuity.audit':
          output = {
            format: 'structured',
            data: [{ severity: 'warning', description: '发现冲突' }],
          }
          break
        case 'narrative.deep.reason':
          output = {
            format: 'structured',
            data: { answer: '保留悬念', assumptions: [], alternatives: [], risks: [] },
          }
          break
        case 'narrative.project.distill':
          output = {
            format: 'structured',
            data: { summary: '项目摘要', entities: [], events: [], promises: [] },
          }
          break
        default:
          throw new Error(`Unexpected slice kind ${task.kind}`)
      }
      const result: TaskResult = { taskId, kind: task.kind, status: 'completed', output }
      return { taskId, kind: task.kind, status: 'completed' as const, result }
    },
    cancelTask: async (taskId: string) => ({
      taskId,
      cancelled: true,
      status: 'cancelled' as const,
    }),
    steerTask: async (taskId: string, input: unknown) => {
      steered.push({ taskId, input })
      return { accepted: true }
    },
    submitted,
    steered,
  }
}

function createMemoryArtifactStore(): ArtifactStore {
  const artifacts = new Map<string, AiArtifact>()
  return {
    save: async (artifact) => {
      artifacts.set(artifact.id, artifact)
    },
    get: async (id) => artifacts.get(id),
    list: async (taskId) => [...artifacts.values()].filter((artifact) => !taskId || artifact.taskId === taskId),
  }
}

describe('vertical slice orchestration', () => {
  it('runs VS1 Continue Prose through the generic task contract', async () => {
    const gateway = makeSliceGateway()
    const intelligence = new CreativeIntelligence(gateway, {
      artifactStore: createMemoryArtifactStore(),
    })

    await expect(
      intelligence.runContinue({ taskId: 'vs1', document: documents[0] }, { pollIntervalMs: 0 }),
    ).resolves.toBe('续写结果')
    expect(gateway.submitted[0]).toMatchObject({
      kind: 'creative.continue',
      executionPolicy: { strategy: 'completion', mode: 'interactive' },
      outputContract: { format: 'text', persistence: 'ephemeral' },
      effectPolicy: { mode: 'read-only' },
    })
  })

  it('runs VS2 Selection Rewrite with a semantic selection and patch output', async () => {
    const gateway = makeSliceGateway()
    const intelligence = new CreativeIntelligence(gateway, {
      artifactStore: createMemoryArtifactStore(),
    })

    await expect(
      intelligence.runRewrite(
        { taskId: 'vs2', document: documents[0], selection: { from: 1, to: 3 }, goal: '更紧凑' },
        { pollIntervalMs: 0 },
      ),
    ).resolves.toEqual({ from: 1, to: 3, text: '改写结果' })
    expect(gateway.submitted[0]).toMatchObject({
      kind: 'creative.rewrite',
      input: {
        selection: { documentId: 'd1', from: 1, to: 3, blockIds: ['d1-block'], revision: 1 },
      },
      outputContract: { format: 'patch', persistence: 'artifact' },
      effectPolicy: { mode: 'proposal', requiresApproval: true },
    })
  })

  it('debounces and deduplicates continuity audits while allowing cancellation', async () => {
    const gateway = makeGateway()
    const scheduler = new ContinuityAuditScheduler(
      new CreativeIntelligence(gateway, { artifactStore: createMemoryArtifactStore() }),
      { debounceMs: 0 },
    )
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

  it('runs VS4 Deep Story Reasoning and forwards steering through the gateway', async () => {
    const gateway = makeSliceGateway()
    const intelligence = new CreativeIntelligence(gateway, {
      artifactStore: createMemoryArtifactStore(),
    })

    await expect(
      intelligence.runDeepReasoning(
        { taskId: 'vs4', document: documents[0], question: '如何保留悬念？' },
        { pollIntervalMs: 0 },
      ),
    ).resolves.toMatchObject({ answer: '保留悬念' })
    await expect(intelligence.steer('vs4', { direction: '保持克制' })).resolves.toBe(true)
    expect(gateway.steered).toEqual([{ taskId: 'vs4', input: { direction: '保持克制' } }])
    expect(gateway.submitted[0]).toMatchObject({
      kind: 'narrative.deep.reason',
      executionPolicy: { strategy: 'reasoning', mode: 'interactive' },
      outputContract: { format: 'structured', persistence: 'artifact' },
    })
  })

  it('maps project distillation into chunks, checkpoints progress, and retries failed chunks', async () => {
    const failedTaskId = 'distill:chunk:1'
    const gateway = makeGateway(new Set([failedTaskId]))
    const workflow = new ProjectDistillationWorkflow(
      new CreativeIntelligence(gateway, { artifactStore: createMemoryArtifactStore() }),
    )
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

  it('rejects invalid distillation chunk sizes before submitting work', async () => {
    const gateway = makeGateway()
    const workflow = new ProjectDistillationWorkflow(
      new CreativeIntelligence(gateway, { artifactStore: createMemoryArtifactStore() }),
    )

    await expect(workflow.run({ taskId: 'invalid', documents }, { chunkSize: Number.NaN })).rejects.toThrow(
      /chunk size/i,
    )
    expect(gateway.submitted.size).toBe(0)
  })
})
