import { beforeEach, describe, expect, it } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import {
  ArtifactConflictError,
  ArtifactRuntime,
  type AiArtifact,
  IndexedDbArtifactStore,
} from './index'

describe('AI artifact runtime', () => {
  beforeEach(async () => {
    for (const artifact of await db.getAll<{ id: string }>('aiArtifacts')) {
      await db.delete('aiArtifacts', artifact.id)
    }
  })

  it('persists semantic content separately from the task output format', async () => {
    const task: AiTask = {
      id: 'task-artifact',
      kind: 'creative.distillation',
      input: { documentId: 'chapter-1' },
      outputContract: { format: 'structured', persistence: 'artifact' },
      metadata: { contextFingerprint: 'abc' },
    }
    const result: TaskResult = {
      taskId: task.id,
      kind: task.kind,
      status: 'completed',
      output: { format: 'structured', data: { summary: '摘要' } },
    }
    const runtime = new ArtifactRuntime(new IndexedDbArtifactStore(), () => 10)
    const artifact = await runtime.persistTaskResult(task, result, 'artifact-1')
    expect(artifact).toMatchObject({
      id: 'artifact-1',
      content: { summary: '摘要' },
      contextFingerprint: 'abc',
      createdAt: 10,
    })
    expect(artifact?.content).not.toHaveProperty('format')
    expect(await new IndexedDbArtifactStore().list(task.id)).toHaveLength(1)
  })

  it('preserves lineage and persists waiting-user results only for artifact policy', async () => {
    const task: AiTask = {
      id: 'task-lineage',
      kind: 'narrative.project.distill',
      input: {
        documentId: 'chapter-1',
        selection: { documentId: 'chapter-1', from: 0, to: 3, revision: 2 },
      },
      outputContract: { format: 'structured', persistence: 'artifact' },
      metadata: {
        parentArtifactId: 'parent-1',
        sessionId: 'session-1',
        executionRunId: 'run-from-task',
        sourceRevision: 7,
      },
    }
    const result: TaskResult = {
      taskId: task.id,
      kind: task.kind,
      status: 'waiting-user',
      output: { format: 'structured', data: { summary: '等待确认' } },
    }
    const runtime = new ArtifactRuntime(new IndexedDbArtifactStore(), {
      now: () => 20,
      idGenerator: { generate: () => 'generated-artifact' },
    })
    const artifact = await runtime.persistTaskResult(task, result)

    expect(artifact).toMatchObject({
      id: 'generated-artifact',
      provenance: {
        taskId: task.id,
        executionRunId: 'run-from-task',
        sessionId: 'session-1',
        parentArtifactId: 'parent-1',
        sourceRevision: 7,
      },
      lineage: {
        sourceTaskId: task.id,
        executionRunId: 'run-from-task',
        parentArtifactId: 'parent-1',
        sourceRevision: 7,
      },
    })

    const failed = await runtime.persistTaskResult(task, {
      ...result,
      status: 'failed',
      output: { format: 'structured', data: { summary: '失败结果不应持久化' } },
    })
    const ephemeral = await runtime.persistTaskResult(
      {
        ...task,
        id: 'task-ephemeral',
        outputContract: { format: 'structured', persistence: 'ephemeral' },
      },
      { ...result, taskId: 'task-ephemeral' },
    )

    expect(failed).toBeUndefined()
    expect(ephemeral).toBeUndefined()
    expect(await new IndexedDbArtifactStore().list()).toHaveLength(1)
  })

  it('is idempotent for compatible content and rejects incompatible same-id writes', async () => {
    const store = new IndexedDbArtifactStore()
    const first = makeArtifact('artifact-conflict', { value: 1 }, 1)
    const sameContent = { ...first, createdAt: 2, updatedAt: 2 }
    const incompatible = makeArtifact('artifact-conflict', { value: 2 }, 3)

    await store.save(first)
    await expect(store.save(sameContent)).resolves.toBeUndefined()
    await expect(store.save(incompatible)).rejects.toBeInstanceOf(ArtifactConflictError)

    await expect(store.get(first.id)).resolves.toMatchObject({
      id: first.id,
      content: { value: 1 },
      createdAt: 1,
    })
  })

  it('rehydrates cloned semantic content and preserves parent lineage', async () => {
    const store = new IndexedDbArtifactStore()
    const runtime = new ArtifactRuntime(store, () => 30)
    const task: AiTask = {
      id: 'task-rehydrate',
      kind: 'narrative.project.distill',
      input: { documentId: 'chapter-2', payload: { context: { revision: 11 } } },
      outputContract: { format: 'structured', persistence: 'artifact' },
      metadata: { parentArtifactId: 'artifact-parent' },
    }
    const payload = { summary: { text: '持久化内容' } }
    const artifact = await runtime.persistTaskResult(task, {
      taskId: task.id,
      kind: task.kind,
      status: 'completed',
      output: { format: 'structured', data: payload },
    }, 'artifact-child')

    payload.summary.text = '调用方修改'
    const rehydrated = await store.get('artifact-child')
    expect(artifact).toMatchObject({
      lineage: { parentArtifactId: 'artifact-parent', sourceTaskId: task.id, sourceRevision: 11 },
      provenance: { parentArtifactId: 'artifact-parent', sourceRevision: 11 },
    })
    expect(rehydrated?.content).toEqual({ summary: { text: '持久化内容' } })
    expect(await store.listByType('creative.distillation-checkpoint')).toHaveLength(1)
  })
})

function makeArtifact(id: string, content: unknown, timestamp: number): AiArtifact {
  return {
    id,
    type: 'creative.chapter-summary',
    version: 1,
    content,
    provenance: { taskId: 'task-artifact' },
    taskId: 'task-artifact',
    kind: 'narrative.project.distill',
    lineage: { sourceTaskId: 'task-artifact' },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
