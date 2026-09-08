import { describe, expect, it } from 'vitest'
import type { SemanticDocument } from '../domain/content'
import {
  CREATIVE_TASK_KINDS,
  CreativeIntelligence,
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
})
