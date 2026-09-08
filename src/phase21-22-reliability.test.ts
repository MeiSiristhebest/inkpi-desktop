// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import {
  CapabilityRouter,
  ContextCache,
  CreativeIntelligence,
  NoCapableRouteError,
  createContinueTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
  parseContinuityFindings,
  parseDeepReasoning,
  parseDistilledFacts,
  createDeterministicTaskCacheKey,
} from './ai'
import { ProposalConflictError, ProposalLedger, proposalFromPatch } from './ai/proposals'
import type { SemanticDocument } from './domain/content'

const document = {
  documentId: 'chapter-1',
  revision: 4,
  text: '她推开门。门后没有人。',
  blocks: [{ id: 'b1', type: 'paragraph', text: '她推开门。门后没有人。', from: 0, to: 12 }],
  sourceMap: {} as SemanticDocument['sourceMap'],
  representation: 'html',
} satisfies SemanticDocument

function completed(task: AiTask, output: TaskResult['output']): TaskResult {
  return { taskId: task.id, kind: task.kind, status: 'completed', output }
}

function gatewayFor(result: (task: AiTask) => TaskResult) {
  const submitted: AiTask[] = []
  return {
    submitted,
    gateway: {
      submitTask: vi.fn(async (task: AiTask) => {
        submitted.push(task)
        return { taskId: task.id, status: 'queued' as const }
      }),
      cancelTask: async (taskId: string) => ({
        taskId,
        cancelled: true,
        status: 'cancelled' as const,
      }),
      getTaskStatus: async (taskId: string) => {
        const task = submitted.find((item) => item.id === taskId)
        if (!task) throw new Error(`Unknown task ${taskId}`)
        return { taskId, kind: task.kind, status: 'completed' as const, result: result(task) }
      },
    },
  }
}

describe('Phase 21/22 local reliability boundaries', () => {
  it('deduplicates equivalent repeated tasks by excluding task id but preserving intent', () => {
    const first = createContinueTask({ taskId: 'repeat-1', document })
    const second = { ...first, id: 'repeat-2' }
    const changedIntent = createRewriteTask({ taskId: 'repeat-3', document, goal: '改写' })

    expect(createDeterministicTaskCacheKey(first)).toEqual(createDeterministicTaskCacheKey(second))
    expect(createDeterministicTaskCacheKey(first).intentFingerprint).not.toBe(
      createDeterministicTaskCacheKey(changedIntent).intentFingerprint,
    )

    const harness = gatewayFor((task) => completed(task, { format: 'text', text: '续写结果' }))
    const intelligence = new CreativeIntelligence(harness.gateway, {
      cache: new ContextCache<TaskResult>(),
    })
    return expect(
      intelligence
        .run(first, { pollIntervalMs: 0 })
        .then(() => intelligence.run(second, { pollIntervalMs: 0 })),
    )
      .resolves.toMatchObject({ taskId: 'repeat-2', provenance: { cacheHit: true } })
      .then(() => {
        expect(harness.submitted).toHaveLength(1)
      })
  })

  it('marks accepted proposals stale on source-hash mismatch without applying a patch', async () => {
    const ledger = new ProposalLedger()
    const proposal = proposalFromPatch(
      {
        taskId: 'rewrite-1',
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
      },
      {
        id: 'proposal-stale-hash',
        documentId: document.documentId,
        baseRevision: document.revision,
        sourceHash: 'old-source',
      },
    )
    ledger.create(proposal)
    ledger.accept(proposal.id)
    const apply = vi.fn()

    await expect(
      ledger.commit(proposal.id, document.revision, apply, 'new-source'),
    ).rejects.toThrow(/source hash/)
    expect(ledger.get(proposal.id)?.status).toBe('stale')
    expect(apply).not.toHaveBeenCalled()
  })

  it('rejects a model that cannot satisfy structured output or context requirements before submission', () => {
    const router = new CapabilityRouter([
      {
        id: 'small-model',
        capabilities: ['creative-reasoning'],
        online: true,
        modelCapabilities: {
          streaming: true,
          structuredOutput: true,
          jsonSchema: false,
          reasoning: true,
          maxContextTokens: 1024,
        },
      },
    ])
    const task = createDeepReasoningTask({ taskId: 'capability-boundary', document })
    task.outputContract = { ...task.outputContract, schemaId: 'deep-reasoning-v1' }
    task.requirements = { ...task.requirements, minContextTokens: 2048 }

    expect(() => router.select(task)).toThrow(NoCapableRouteError)
  })

  it('rejects malformed structured results at the typed result boundary', () => {
    expect(() =>
      parseContinuityFindings({
        taskId: 'invalid-1',
        kind: 'audit',
        status: 'completed',
        output: { format: 'structured', data: [{ severity: 'critical', description: 'bad' }] },
      }),
    ).toThrow(/invalid severity/)
    expect(() =>
      parseDeepReasoning({
        taskId: 'invalid-2',
        kind: 'reason',
        status: 'completed',
        output: { format: 'structured', data: { answer: 42 } },
      }),
    ).toThrow(/missing answer/)
    expect(() =>
      parseDistilledFacts({
        taskId: 'invalid-3',
        kind: 'distill',
        status: 'completed',
        output: {
          format: 'structured',
          data: { summary: 'ok', entities: [{ kind: 'character' }] },
        },
      }),
    ).toThrow(/require kind and name/)
  })

  it('invalidates cached results when the project revision changes', async () => {
    const harness = gatewayFor((task) =>
      completed(task, { format: 'structured', data: { summary: task.metadata?.projectRevision } }),
    )
    const intelligence = new CreativeIntelligence(harness.gateway, {
      cache: new ContextCache<TaskResult>(),
    })
    const base = createDistillationTask({
      taskId: 'revision-1',
      document,
      metadata: { projectRevision: 4 },
    })
    const changed = {
      ...base,
      id: 'revision-2',
      metadata: { ...base.metadata, projectRevision: 5 },
    }

    await intelligence.run(base, { pollIntervalMs: 0 })
    const result = await intelligence.run(changed, { pollIntervalMs: 0 })

    expect(harness.submitted).toHaveLength(2)
    expect(result.provenance).toMatchObject({ cacheHit: false, projectRevision: 5 })
  })

  it('keeps stale revision conflicts distinct from malformed output failures', async () => {
    const ledger = new ProposalLedger()
    const proposal = proposalFromPatch(
      {
        taskId: 'rewrite-2',
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
      },
      { id: 'proposal-stale-revision', documentId: document.documentId, baseRevision: 4 },
    )
    ledger.create(proposal)
    ledger.accept(proposal.id)

    await expect(ledger.commit(proposal.id, 5, async () => undefined)).rejects.toBeInstanceOf(
      ProposalConflictError,
    )
    expect(ledger.get(proposal.id)?.status).toBe('stale')
  })
})
