import { describe, expect, it } from 'vitest'
import type { ChapterRecord, VolumeRecord } from '../types'
import { DB_NAME, db, readIndexInTransaction } from './indexedDB'

/**
 * readIndexInTransaction is the shared primitive every hot path now uses to read its own project's
 * rows from inside the same transaction that validates and writes them. It has two branches with
 * identical semantics — a real index read and a whole-store filter used when the index is absent —
 * and both must return exactly the project's rows. The wrapper's getByIndex already swallows this
 * difference, so the only way to trust the fallback is to hit it on a store that genuinely lacks
 * the index.
 */

const OWN = 'ws-read-index-own'
const NEIGHBOUR = 'ws-read-index-neighbour'

function volume(id: string, projectId: string): VolumeRecord {
  return { id, projectId, title: id, order: 0, createdAt: 1, updatedAt: 1 }
}

function chapter(id: string, projectId: string): ChapterRecord {
  return {
    id,
    projectId,
    volumeId: 'vol-1',
    title: id,
    content: '正文',
    order: 0,
    wordCount: 2,
    createdAt: 1,
    updatedAt: 1,
  }
}

function readInTransaction<T>(
  storeName: Parameters<typeof db.runTransaction>[0][number],
  indexName: string,
  queryValue: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.runTransaction([storeName], (transaction, fail) => {
      readIndexInTransaction<T>(transaction.objectStore(storeName), indexName, queryValue, {
        onSuccess: resolve,
        onError: fail,
      })
    })
      .then(() => undefined)
      .catch(reject)
  })
}

async function clear(storeName: Parameters<typeof db.runTransaction>[0][number], ids: string[]) {
  for (const id of ids) await db.delete(storeName, id)
}

function indexNamesOf(storeName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onsuccess = () => {
      const raw = request.result
      try {
        resolve(
          Array.from(raw.transaction(storeName, 'readonly').objectStore(storeName).indexNames),
        )
      } finally {
        raw.close()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

describe('readIndexInTransaction', () => {
  it('falls back to a property filter on a store that has no projectId index', async () => {
    const ids = ['rio-vol-own', 'rio-vol-neighbour']
    await clear('volumes', ids)
    await db.put('volumes', volume('rio-vol-own', OWN))
    await db.put('volumes', volume('rio-vol-neighbour', NEIGHBOUR))

    // volumes is created without any index, so this exercises the degraded branch for real. The
    // seed above is what runs the wrapper's upgrade; only it knows the schema, so probing indexNames
    // before any db access would open an empty library.
    expect(await indexNamesOf('volumes')).not.toContain('projectId')

    const rows = await readInTransaction<VolumeRecord>('volumes', 'projectId', OWN)
    expect(rows.map((row) => row.id)).toEqual(['rio-vol-own'])

    await clear('volumes', ids)
  })

  it('reads through the index on a store that has one', async () => {
    const ids = ['rio-ch-own', 'rio-ch-neighbour']
    await clear('chapters', ids)
    await db.put('chapters', chapter('rio-ch-own', OWN))
    await db.put('chapters', chapter('rio-ch-neighbour', NEIGHBOUR))

    expect(await indexNamesOf('chapters')).toContain('projectId')

    const rows = await readInTransaction<ChapterRecord>('chapters', 'projectId', OWN)
    expect(rows.map((row) => row.id)).toEqual(['rio-ch-own'])

    // No match must resolve to an empty list rather than the whole store.
    const none = await readInTransaction<ChapterRecord>('chapters', 'projectId', 'ws-absent')
    expect(none).toEqual([])

    await clear('chapters', ids)
  })
})
