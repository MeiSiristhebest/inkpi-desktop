import { describe, expect, it } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import { IndexedDbTaskRecoveryStore } from './taskRecoveryStore'

const task: AiTask = {
  id: 'recovery-store-task',
  kind: 'creative.continue',
  input: { documentId: 'chapter-1', text: '片段' },
}

describe('IndexedDbTaskRecoveryStore', () => {
  it('persists a task snapshot in the existing settingsKV store and removes it', async () => {
    const store = new IndexedDbTaskRecoveryStore()
    const record = {
      projectId: 'recovery-store-project',
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'interrupted' as const,
        checkpoint: { step: 'chapter-1', updatedAt: 10 },
      },
      updatedAt: 10,
    }

    await store.save(record)
    await expect(store.list(record.projectId)).resolves.toEqual([record])

    await store.remove(record.projectId, task.id)
    await expect(store.list(record.projectId)).resolves.toEqual([])
  })

  it('does not mix records from another project', async () => {
    const store = new IndexedDbTaskRecoveryStore()
    const first = {
      projectId: 'recovery-project-a',
      task: { ...task, id: 'recovery-a' },
      snapshot: { taskId: 'recovery-a', kind: task.kind, status: 'failed' as const },
      updatedAt: 1,
    }
    const second = {
      projectId: 'recovery-project-b',
      task: { ...task, id: 'recovery-b' },
      snapshot: { taskId: 'recovery-b', kind: task.kind, status: 'cancelled' as const },
      updatedAt: 2,
    }

    await store.save(first)
    await store.save(second)
    await expect(store.list(first.projectId)).resolves.toEqual([first])
    await expect(store.list(second.projectId)).resolves.toEqual([second])

    await store.remove(first.projectId, first.task.id)
    await store.remove(second.projectId, second.task.id)
  })
})
