import { describe, expect, it } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import { ArtifactRuntime, IndexedDbArtifactStore } from './index'

describe('AI artifact runtime', () => {
  it('persists durable structured output separately from task output format', async () => {
    for (const artifact of await db.getAll<{ id: string }>('aiArtifacts')) {
      await db.delete('aiArtifacts', artifact.id)
    }
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
      content: { format: 'structured', data: { summary: '摘要' } },
      contextFingerprint: 'abc',
      createdAt: 10,
    })
    expect(await new IndexedDbArtifactStore().list(task.id)).toHaveLength(1)
  })
})
