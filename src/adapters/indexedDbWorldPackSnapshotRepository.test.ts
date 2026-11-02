import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import type { NewWorldPackSnapshot } from '../ports/worldPackSnapshotRepository'
import { indexedDbWorldPackSnapshotRepository as repository } from './indexedDbWorldPackSnapshotRepository'

const sourceProjectId = 'world-pack-repository-test'

function draft(id: string, worldbase: Record<string, unknown> = {}): NewWorldPackSnapshot {
  return {
    id,
    schemaVersion: 1,
    sourceProjectId,
    sourceProjectName: 'Snapshot test source',
    createdAt: 100,
    worldbase,
    entities: [],
  }
}

afterEach(async () => {
  const snapshots = await repository.listBySourceProject(sourceProjectId)
  await Promise.all(snapshots.map((snapshot) => db.delete('worldPackSnapshots', snapshot.id)))
})

describe('IndexedDB world-pack snapshot repository', () => {
  it('appends consecutive immutable versions even when creation is concurrent', async () => {
    const [first, second] = await Promise.all([
      repository.createVersion(draft('world-pack-repository-v1', { origin: 'first' })),
      repository.createVersion(draft('world-pack-repository-v2', { origin: 'second' })),
    ])

    expect([first.version, second.version].sort()).toEqual([1, 2])
    const stored = await repository.listBySourceProject(sourceProjectId)
    expect(stored.map((snapshot) => snapshot.version).sort()).toEqual([1, 2])
    expect(await repository.get(first.id)).toEqual(first)

    first.worldbase.origin = 'changed in caller memory'
    expect(await repository.get(first.id)).not.toEqual(first)
    expect((await repository.get(first.id))?.worldbase.origin).not.toBe('changed in caller memory')
  })
})
