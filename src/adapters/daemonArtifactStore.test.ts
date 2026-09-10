import { describe, expect, it, vi } from 'vitest'
import type { Artifact as RuntimeArtifact } from '@inkpi/protocol'
import type { RpcClient } from '../ports/aiGateway'
import type { AiArtifact } from '../ai/artifacts'
import { DaemonArtifactStore } from './daemonArtifactStore'

describe('DaemonArtifactStore', () => {
  it('preserves desktop artifact metadata across Runtime RPC', async () => {
    const request = vi.fn<RpcClient['request']>().mockResolvedValue({ saved: true, id: 'artifact-1' })
    const store = new DaemonArtifactStore({ request, close: vi.fn() })
    const artifact = createArtifact()

    await store.save(artifact)

    expect(request).toHaveBeenCalledWith(
      'artifact.save',
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: artifact.id,
          provenance: expect.objectContaining({
            __inkpiDesktopArtifact: expect.objectContaining({
              taskId: artifact.taskId,
              kind: artifact.kind,
              lineage: artifact.lineage,
            }),
          }),
        }),
      }),
    )
  })

  it('maps Runtime artifacts and forwards task/type filters', async () => {
    const runtimeArtifact: RuntimeArtifact = {
      id: 'artifact-2',
      type: 'creative.story-plan',
      version: 1,
      content: { title: 'Plan' },
      provenance: {
        __inkpiDesktopArtifact: { taskId: 'task-2', kind: 'narrative.plan' },
      },
      createdAt: 10,
      updatedAt: 11,
    }
    const request = vi
      .fn<RpcClient['request']>()
      .mockResolvedValueOnce([runtimeArtifact])
      .mockResolvedValueOnce([runtimeArtifact])
      .mockResolvedValueOnce(runtimeArtifact)
    const store = new DaemonArtifactStore({ request, close: vi.fn() })

    await expect(store.list('task-2')).resolves.toEqual([expect.objectContaining({ taskId: 'task-2' })])
    await expect(store.listByType('creative.story-plan')).resolves.toEqual([
      expect.objectContaining({ kind: 'narrative.plan' }),
    ])
    await expect(store.get(runtimeArtifact.id)).resolves.toEqual(
      expect.objectContaining({ id: runtimeArtifact.id, provenance: {} }),
    )
    expect(request).toHaveBeenNthCalledWith(1, 'artifact.list', { taskId: 'task-2' })
    expect(request).toHaveBeenNthCalledWith(2, 'artifact.list', { type: 'creative.story-plan' })
    expect(request).toHaveBeenNthCalledWith(3, 'artifact.get', { id: runtimeArtifact.id })
  })
})

function createArtifact(): AiArtifact {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    kind: 'narrative.plan',
    type: 'creative.story-plan',
    version: 1,
    content: { title: 'Plan' },
    provenance: { taskId: 'task-1' },
    lineage: { sourceTaskId: 'task-1', taskId: 'task-1' },
    createdAt: 10,
    updatedAt: 11,
  }
}
