import { describe, expect, it } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import {
  ArtifactConflictError,
  ArtifactRuntime,
  ArtifactSerializationError,
  IndexedDbArtifactStore,
  serializeArtifactForExport,
  type AiArtifact,
} from './index'

describe('artifact export and persistence boundary', () => {
  it('keeps parent lineage and produces stable canonical JSON', () => {
    const first: AiArtifact = {
      id: 'artifact-export',
      type: 'creative.chapter-summary',
      version: 1,
      content: { zeta: { b: 2, a: 1 }, alpha: ['stable'] },
      provenance: {
        sessionId: 'session-1',
        parentArtifactId: 'artifact-parent',
        taskId: 'task-export',
      },
      taskId: 'task-export',
      kind: 'narrative.project.distill',
      lineage: { sourceTaskId: 'task-export', parentArtifactId: 'artifact-parent' },
      createdAt: 1,
      updatedAt: 2,
    }
    const reordered: AiArtifact = {
      updatedAt: 2,
      createdAt: 1,
      lineage: { parentArtifactId: 'artifact-parent', sourceTaskId: 'task-export' },
      kind: 'narrative.project.distill',
      taskId: 'task-export',
      provenance: {
        taskId: 'task-export',
        parentArtifactId: 'artifact-parent',
        sessionId: 'session-1',
      },
      content: { alpha: ['stable'], zeta: { a: 1, b: 2 } },
      version: 1,
      type: 'creative.chapter-summary',
      id: 'artifact-export',
    }

    const firstExport = serializeArtifactForExport(first)
    expect(firstExport).toBe(serializeArtifactForExport(reordered))
    expect(JSON.parse(firstExport)).toMatchObject({
      provenance: { parentArtifactId: 'artifact-parent' },
      lineage: { parentArtifactId: 'artifact-parent' },
      content: { alpha: ['stable'], zeta: { a: 1, b: 2 } },
    })
  })

  it('rejects unsupported payloads before IndexedDB persistence', async () => {
    const store = new IndexedDbArtifactStore()
    const runtime = new ArtifactRuntime(store, {
      now: () => 10,
      idGenerator: () => 'artifact-unsupported',
    })
    const task = makeTask('task-unsupported')

    await expect(
      runtime.persistTaskResult(task, {
        taskId: task.id,
        kind: task.kind,
        status: 'completed',
        output: {
          format: 'structured',
          data: { summary: new Map([['text', 'not-json']]) },
        },
      }),
    ).rejects.toMatchObject({
      code: 'ARTIFACT_NOT_SERIALIZABLE',
    } satisfies Partial<ArtifactSerializationError>)
    await expect(store.get('artifact-unsupported')).resolves.toBeUndefined()
  })

  it('allows a compatible retry after a same-id conflict', async () => {
    const store = new IndexedDbArtifactStore()
    const runtime = new ArtifactRuntime(store, () => 20)
    const task = makeTask('task-recover')
    const result = (value: string) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'structured' as const, data: { value } },
    })

    await runtime.persistTaskResult(task, result('first'), 'artifact-recover')
    await expect(
      runtime.persistTaskResult(task, result('second'), 'artifact-recover'),
    ).rejects.toBeInstanceOf(ArtifactConflictError)

    await expect(
      runtime.persistTaskResult(task, result('first'), 'artifact-recover'),
    ).resolves.toMatchObject({
      id: 'artifact-recover',
      content: { value: 'first' },
    })
  })
})

function makeTask(id: string): AiTask {
  return {
    id,
    kind: 'narrative.project.distill',
    input: { documentId: 'chapter-1' },
    outputContract: { format: 'structured', persistence: 'artifact' },
  }
}
