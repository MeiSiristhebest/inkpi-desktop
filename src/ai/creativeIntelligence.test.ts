import { describe, expect, it } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import type { SemanticDocument } from '../domain/content'
import {
  CapabilityRouter,
  ContextCache,
  CREATIVE_TASK_KINDS,
  CreativeIntelligence,
  NoCapableRouteError,
  createContinueTask,
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
  parseContinuityFindings,
  parseDeepReasoning,
  parseDistilledFacts,
  requirePatchResult,
  requireTextResult,
} from './index'

const document = {
  documentId: 'chapter-1',
  revision: 4,
  text: '她推开门。\n门后没有人。',
  blocks: [
    { id: 'b1', type: 'paragraph', text: '她推开门。', from: 0, to: 5 },
    { id: 'b2', type: 'paragraph', text: '门后没有人。', from: 6, to: 12 },
  ],
  sourceMap: {} as SemanticDocument['sourceMap'],
  representation: 'html',
} satisfies SemanticDocument

describe('Creative Intelligence Layer', () => {
  it('builds all five vertical slices from canonical content and separates effects', () => {
    const common = { taskId: 'creative-task', document }
    const tasks = [
      createContinueTask(common),
      createRewriteTask({ ...common, goal: '更紧凑' }),
      createContinuityAuditTask(common),
      createDeepReasoningTask({ ...common, question: '门后有什么叙事作用？' }),
      createDistillationTask({ ...common, target: 'document' }),
    ]

    expect(tasks.map((task) => task.kind)).toEqual([
      CREATIVE_TASK_KINDS.continue,
      CREATIVE_TASK_KINDS.rewrite,
      CREATIVE_TASK_KINDS.continuityAudit,
      CREATIVE_TASK_KINDS.deepReasoning,
      CREATIVE_TASK_KINDS.distillation,
    ])
    expect(tasks[0].outputContract).toMatchObject({ format: 'text' })
    expect(tasks[0].effectPolicy).toEqual({ mode: 'read-only' })
    expect(tasks[1].outputContract).toMatchObject({ format: 'patch' })
    expect(tasks[2].effectPolicy).toEqual({ mode: 'read-only' })
    expect(tasks.every((task) => task.input.payload)).toBe(true)
    expect(tasks[0].metadata?.contextFingerprint).toBeTruthy()
  })

  it('parses typed vertical-slice results and rejects contract violations', () => {
    expect(
      requireTextResult({
        taskId: 't',
        kind: CREATIVE_TASK_KINDS.continue,
        status: 'completed',
        output: { format: 'text', text: '继续' },
      }),
    ).toBe('继续')
    expect(
      requirePatchResult({
        taskId: 't',
        kind: CREATIVE_TASK_KINDS.rewrite,
        status: 'completed',
        output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
      }),
    ).toEqual({ from: 0, to: 1, text: '改' })
    expect(
      parseContinuityFindings({
        taskId: 't',
        kind: CREATIVE_TASK_KINDS.continuityAudit,
        status: 'completed',
        output: { format: 'structured', data: [{ severity: 'warning', description: '时间线冲突' }] },
      }),
    ).toHaveLength(1)
    expect(
      parseDeepReasoning({
        taskId: 't',
        kind: CREATIVE_TASK_KINDS.deepReasoning,
        status: 'completed',
        output: { format: 'structured', data: { answer: '保留悬念' } },
      }).answer,
    ).toBe('保留悬念')
    expect(
      parseDistilledFacts({
        taskId: 't',
        kind: CREATIVE_TASK_KINDS.distillation,
        status: 'completed',
        output: {
          format: 'structured',
          data: { summary: '摘要', entities: [{ kind: 'character', name: '她' }] },
        },
      }).summary,
    ).toBe('摘要')
    expect(() => requireTextResult({ taskId: 't', kind: 'x', status: 'failed' })).toThrow()
  })

  it('polls the generic task gateway and cancels through the same contract', async () => {
    const statuses = ['running', 'completed'] as const
    let calls = 0
    const gateway = {
      submitTask: async () => ({ taskId: 't', status: 'queued' as const }),
      cancelTask: async () => ({ taskId: 't', cancelled: true, status: 'cancelled' as const }),
      getTaskStatus: async () => {
        const status = statuses[Math.min(calls++, statuses.length - 1)]
        return {
          taskId: 't',
          kind: 'test',
          status,
          result:
            status === 'completed'
              ? { taskId: 't', kind: 'test', status: 'completed' as const, output: { format: 'text' as const, text: 'ok' } }
              : undefined,
        }
      },
    }
    const result = await new CreativeIntelligence(gateway).run(
      createContinueTask({ taskId: 't', document }),
      { pollIntervalMs: 0 },
    )
    expect(result.status).toBe('completed')
    expect(calls).toBe(2)
  })

  it('routes task execution, reuses cache hits, and invalidates on project revision', async () => {
    const submitted: AiTask[] = []
    const gateway = {
      submitTask: async (task: AiTask) => {
        submitted.push(task)
        return { taskId: task.id, status: 'queued' as const }
      },
      cancelTask: async (taskId: string) => ({ taskId, cancelled: true, status: 'cancelled' as const }),
      getTaskStatus: async (taskId: string) => ({
        taskId,
        kind: CREATIVE_TASK_KINDS.continue,
        status: 'completed' as const,
        result: {
          taskId,
          kind: CREATIVE_TASK_KINDS.continue,
          status: 'completed' as const,
          output: { format: 'text' as const, text: 'cached continuation' },
        },
      }),
    }
    const cache = new ContextCache<TaskResult>()
    const intelligence = new CreativeIntelligence(gateway, {
      capabilityRouter: new CapabilityRouter([
        {
          id: 'preferred-route',
          providerId: 'provider-a',
          modelId: 'model-a',
          capabilities: ['creative-writing'],
          online: true,
          priority: 10,
          metadata: { region: 'local' },
          modelCapabilities: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            jsonSchema: true,
            reasoning: true,
            promptCaching: true,
            maxContextTokens: 32_000,
            maxOutputTokens: 4_096,
          },
        },
      ]),
      cache,
    })
    const baseTask = createContinueTask({ taskId: 'cache-1', document })
    const task = {
      ...baseTask,
      metadata: {
        ...baseTask.metadata,
        instructionVersion: 'instruction-v1',
        skillVersion: 'skill-v1',
        projectRevision: 4,
        contextFingerprint: 'context-v1',
      },
    }

    const first = await intelligence.run(task, { pollIntervalMs: 0 })
    const second = await intelligence.run({ ...task, id: 'cache-2' }, { pollIntervalMs: 0 })
    const third = await intelligence.run(
      { ...task, id: 'cache-3', metadata: { ...task.metadata, projectRevision: 5 } },
      { pollIntervalMs: 0 },
    )

    expect(submitted).toHaveLength(2)
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 2 })
    expect(first.provenance).toMatchObject({
      routeId: 'preferred-route',
      providerId: 'provider-a',
      modelId: 'model-a',
      routeMetadata: { region: 'local' },
      instructionVersion: 'instruction-v1',
      skillVersion: 'skill-v1',
      projectRevision: 4,
      contextFingerprint: 'context-v1',
      cacheHit: false,
    })
    expect(second.taskId).toBe('cache-2')
    expect(second.provenance).toMatchObject({ cacheHit: true, routeId: 'preferred-route' })
    expect(third.provenance).toMatchObject({ cacheHit: false, projectRevision: 5 })
    expect(submitted[0].metadata).toMatchObject({
      routeId: 'preferred-route',
      providerId: 'provider-a',
      modelId: 'model-a',
      routing: { routeId: 'preferred-route', matchedCapabilities: ['creative-writing'] },
    })
  })

  it('fails before submission when no route or model capability can satisfy a task', async () => {
    const submitted: AiTask[] = []
    const gateway = {
      submitTask: async (task: AiTask) => {
        submitted.push(task)
        return { taskId: task.id, status: 'queued' as const }
      },
      cancelTask: async (taskId: string) => ({ taskId, cancelled: true, status: 'cancelled' as const }),
      getTaskStatus: async () => ({ taskId: 'never', kind: 'never', status: 'failed' as const }),
    }

    await expect(
      new CreativeIntelligence(gateway, { routes: [] }).run(createContinueTask({ taskId: 'no-route', document })),
    ).rejects.toThrow(NoCapableRouteError)
    await expect(
      new CreativeIntelligence(gateway, {
        capabilityRouter: new CapabilityRouter([
          {
            id: 'non-streaming',
            capabilities: ['creative-writing'],
            online: true,
            modelCapabilities: {
              streaming: false,
              toolCalling: false,
              structuredOutput: false,
              jsonSchema: false,
              reasoning: false,
              promptCaching: false,
              maxContextTokens: 4_096,
              maxOutputTokens: 512,
            },
          },
        ]),
      }).run(createContinueTask({ taskId: 'capability-mismatch', document })),
    ).rejects.toThrow(NoCapableRouteError)
    expect(submitted).toHaveLength(0)
  })
})
