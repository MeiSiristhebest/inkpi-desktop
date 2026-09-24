import { describe, expect, it } from 'vitest'
import type { ChapterRecord } from '../types'
import { DB_NAME, DB_VERSION, db } from './indexedDB'

/**
 * The store wrapper only creates indexes for stores it creates inside the same upgrade, so a
 * pre-existing library never gains a newly required index. chapters carries the manuscript and is
 * listed by projectId on every project switch, so its index has to be added to stores that were
 * created before the index existed — without losing a single row (INV-01).
 */

const LEGACY_WORKSPACE = 'p-legacy'
const OTHER_WORKSPACE = 'p-legacy-other'

function legacyChapter(projectId: string, id: string): ChapterRecord {
  return {
    id,
    projectId,
    volumeId: `${projectId}-v-01`,
    title: `旧章节 ${id}`,
    content: '寒潭惊变，青灯古寺。',
    wordCount: 12,
    order: 1,
    createdAt: 1_600_000_000_000,
    updatedAt: 1_600_000_000_000,
  }
}

function openRaw(
  version: number,
  onUpgrade?: (database: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => onUpgrade?.(request.result)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function removeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`${DB_NAME} deletion was blocked`))
  })
}

function putLegacyChapters(database: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('chapters', 'readwrite')
    const store = transaction.objectStore('chapters')
    store.put(legacyChapter(LEGACY_WORKSPACE, 'legacy-chapter-1'))
    store.put(legacyChapter(LEGACY_WORKSPACE, 'legacy-chapter-2'))
    store.put(legacyChapter(OTHER_WORKSPACE, 'legacy-other-chapter-1'))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

describe('chapters projectId index upgrade', () => {
  it('indexes a chapters store that predates the index and keeps every row', async () => {
    await removeDatabase()

    // A library as an existing user would have it: created before the index existed, already
    // holding chapters for two projects.
    const legacyVersion = DB_VERSION - 1
    const legacy = await openRaw(legacyVersion, (database) => {
      database.createObjectStore('chapters', { keyPath: 'id' })
    })
    expect(
      Array.from(legacy.transaction('chapters', 'readonly').objectStore('chapters').indexNames),
    ).toEqual([])
    await putLegacyChapters(legacy)
    legacy.close()

    // Opening through the wrapper upgrades to the current version.
    const upgraded = await db.getByIndex<ChapterRecord>('chapters', 'projectId', LEGACY_WORKSPACE)
    expect(upgraded.map((record) => record.id)).toEqual(['legacy-chapter-1', 'legacy-chapter-2'])
    expect(await db.getByIndex<ChapterRecord>('chapters', 'projectId', OTHER_WORKSPACE)).toEqual([
      legacyChapter(OTHER_WORKSPACE, 'legacy-other-chapter-1'),
    ])
    expect(await db.getAll<ChapterRecord>('chapters')).toHaveLength(3)

    const raw = await openRaw(DB_VERSION)
    try {
      expect(
        Array.from(raw.transaction('chapters', 'readonly').objectStore('chapters').indexNames),
      ).toContain('projectId')
    } finally {
      raw.close()
    }
  })
})
