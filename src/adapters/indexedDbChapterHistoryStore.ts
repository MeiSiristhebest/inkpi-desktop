import { db } from '../db/indexedDB'
import type { KeyValueStore } from '../ports/keyValueStore'

const HISTORY_NAMESPACE = '::chapter-history::'

export function chapterHistoryStorageKey(workspaceId: string, chapterId: string): string {
  return `${workspaceId}${HISTORY_NAMESPACE}${chapterId}`
}

function legacyHistoryKey(storageKey: string): string | null {
  const separator = storageKey.indexOf(HISTORY_NAMESPACE)
  if (separator <= 0 || separator + HISTORY_NAMESPACE.length >= storageKey.length) return null
  return `chapter-history-${storageKey.slice(separator + HISTORY_NAMESPACE.length)}`
}

/** Chapter snapshots are workspace data. IndexedDB is canonical; localStorage is migration-only. */
export const indexedDbChapterHistoryStore: KeyValueStore = {
  async get(key: string): Promise<string | null> {
    const record = await db.get<{ key: string; value: unknown }>('settingsKV', key)
    const legacyKey = legacyHistoryKey(key)
    if (typeof record?.value === 'string') {
      if (legacyKey && typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(legacyKey)
        } catch {
          // IndexedDB already owns the snapshot.
        }
      }
      return record.value
    }
    if (!legacyKey || typeof localStorage === 'undefined') return null

    let legacyValue: string | null = null
    try {
      legacyValue = localStorage.getItem(legacyKey)
    } catch {
      return null
    }
    if (legacyValue === null) return null

    await db.put('settingsKV', { key, value: legacyValue })
    try {
      localStorage.removeItem(legacyKey)
    } catch {
      // IndexedDB already owns the migrated snapshot.
    }
    return legacyValue
  },

  async set(key: string, value: string): Promise<void> {
    await db.put('settingsKV', { key, value })
    const legacyKey = legacyHistoryKey(key)
    if (!legacyKey || typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(legacyKey)
    } catch {
      // The canonical write has completed.
    }
  },

  async remove(key: string): Promise<void> {
    await db.delete('settingsKV', key)
    const legacyKey = legacyHistoryKey(key)
    if (!legacyKey || typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(legacyKey)
    } catch {
      // The canonical record has been removed.
    }
  },
}
