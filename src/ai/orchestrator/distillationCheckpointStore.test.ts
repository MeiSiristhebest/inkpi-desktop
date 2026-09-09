import { afterEach, describe, expect, it } from 'vitest'
import type { SemanticDocument } from '../../domain/content'
import { db } from '../../db/indexedDB'
import {
  createDistillationSourceFingerprint,
  distillationCheckpointKey,
  IndexedDbDistillationCheckpointStore,
} from './distillationCheckpointStore'
import type { DistillationCheckpoint } from './verticalSlices'

const projectId = 'checkpoint-store-test-project'
const taskId = 'checkpoint-store-test-task'
const store = new IndexedDbDistillationCheckpointStore()

const checkpoint: DistillationCheckpoint = {
  nextChunk: 1,
  completedChunkIndexes: [0],
  failedChunkIndexes: [],
  failedChunks: [],
  facts: { summary: '第一批已完成', entities: [], events: [], promises: [] },
}

const documents = (text: string, revision = 1): SemanticDocument[] => [
  {
    documentId: 'document-1',
    revision,
    text,
    blocks: [],
    sourceMap: {},
    representation: 'text',
  } as unknown as SemanticDocument,
]

afterEach(async () => {
  await store.clear(projectId, taskId)
})

describe('IndexedDB distillation checkpoint store', () => {
  it('persists a cloned checkpoint and rejects a different source revision', async () => {
    const sourceFingerprint = createDistillationSourceFingerprint(documents('原文'))
    await store.save(projectId, taskId, checkpoint, sourceFingerprint)

    const loaded = await store.load(projectId, taskId, sourceFingerprint)
    expect(loaded).toEqual(checkpoint)
    loaded!.facts.summary = '调用方修改不会回写'
    await expect(store.load(projectId, taskId, sourceFingerprint)).resolves.toEqual(checkpoint)

    const changedFingerprint = createDistillationSourceFingerprint(documents('新原文', 2))
    await expect(store.load(projectId, taskId, changedFingerprint)).resolves.toBeUndefined()
  })

  it('ignores malformed persisted checkpoints instead of resuming unsafe state', async () => {
    await db.put('settingsKV', {
      key: distillationCheckpointKey(projectId, taskId),
      projectId,
      taskId,
      updatedAt: 1,
      checkpoint: { nextChunk: -1, completedChunkIndexes: 'invalid' },
    })

    await expect(store.load(projectId, taskId)).resolves.toBeUndefined()
  })

  it('changes source fingerprints when document content or revision changes', () => {
    const original = createDistillationSourceFingerprint(documents('原文'))
    expect(createDistillationSourceFingerprint(documents('新文'))).not.toBe(original)
    expect(createDistillationSourceFingerprint(documents('原文', 2))).not.toBe(original)
  })
})
