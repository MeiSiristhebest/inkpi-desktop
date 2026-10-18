import type { AtomicKeyValueStore, KeyValueStore } from '../ports/keyValueStore'

export interface ChapterHistorySnapshot {
  id?: string
  name?: string
  timestamp: number
  wordCount: number
  content: string
  kind?: 'auto' | 'milestone'
}

const pendingWrites = new WeakMap<KeyValueStore, Map<string, Promise<unknown>>>()

function parseSnapshots<T>(raw: string | null, key: string): T[] {
  if (raw === null) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`Chapter history for "${key}" is not an array`)
  return parsed as T[]
}

/** Apply one read-modify-write history update at a time for each store and chapter. */
export async function updateChapterHistorySnapshots<T>(
  store: KeyValueStore,
  key: string,
  update: (current: T[]) => T[],
): Promise<T[]> {
  const atomicStore = store as Partial<AtomicKeyValueStore>
  if (typeof atomicStore.update === 'function') {
    const persisted = await atomicStore.update(key, (raw) =>
      JSON.stringify(update(parseSnapshots<T>(raw, key))),
    )
    return parseSnapshots<T>(persisted, key)
  }

  let writesByKey = pendingWrites.get(store)
  if (!writesByKey) {
    writesByKey = new Map()
    pendingWrites.set(store, writesByKey)
  }

  const previousWrite = writesByKey.get(key) ?? Promise.resolve()
  const currentWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      const raw = await store.get(key)
      const current = parseSnapshots<T>(raw, key)
      const next = update(current)
      await store.set(key, JSON.stringify(next))
      return next
    })

  writesByKey.set(key, currentWrite)
  try {
    return await currentWrite
  } finally {
    if (writesByKey.get(key) === currentWrite) writesByKey.delete(key)
    if (writesByKey.size === 0) pendingWrites.delete(store)
  }
}
