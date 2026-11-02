import { db } from '../db/indexedDB'
import type { WorldPackSnapshot } from '../domain/worldPacks/worldPack'
import type {
  NewWorldPackSnapshot,
  WorldPackSnapshotRepository,
} from '../ports/worldPackSnapshotRepository'

export const indexedDbWorldPackSnapshotRepository: WorldPackSnapshotRepository = {
  list: () => db.getAll<WorldPackSnapshot>('worldPackSnapshots'),
  listBySourceProject: (sourceProjectId) =>
    db.getByIndex<WorldPackSnapshot>('worldPackSnapshots', 'sourceProjectId', sourceProjectId),
  get: (id) => db.get<WorldPackSnapshot>('worldPackSnapshots', id),
  createVersion: async (draft: NewWorldPackSnapshot) => {
    let created: WorldPackSnapshot | undefined
    await db.runTransaction(['worldPackSnapshots'], (transaction, fail) => {
      const store = transaction.objectStore('worldPackSnapshots')
      const request = store.index('sourceProjectId').getAll(draft.sourceProjectId)
      request.onsuccess = () => {
        try {
          const previous = request.result as WorldPackSnapshot[]
          const version = previous.reduce((max, snapshot) => Math.max(max, snapshot.version), 0) + 1
          created = { ...structuredClone(draft), version }
          store.add(created)
        } catch (error) {
          fail(error)
        }
      }
      request.onerror = () => fail(request.error)
    })
    if (!created) throw new Error('World-pack snapshot transaction completed without a record.')
    return created
  },
}
