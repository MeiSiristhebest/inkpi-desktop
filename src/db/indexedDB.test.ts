import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, uid } from './indexedDB'
import type { ChapterRecord, VolumeRecord } from '../types'

const chapter = (over: Partial<ChapterRecord> = {}): ChapterRecord => ({
  id: 'c1',
  projectId: 'p1',
  volumeId: 'v1',
  title: 'T',
  content: 'c',
  wordCount: 1,
  order: 0,
  createdAt: 1,
  updatedAt: 2,
  ...over,
})

const volume = (over: Partial<VolumeRecord> = {}): VolumeRecord => ({
  id: 'v1',
  projectId: 'p1',
  title: 'V',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

beforeEach(async () => {
  for (const store of ['volumes', 'chapters'] as const) {
    const all = await db.getAll<{ id: string }>(store)
    await Promise.all(all.map((r) => db.delete(store, r.id)))
  }
})

describe('uid', () => {
  it('uses the given prefix', () => {
    expect(uid('vol')).toMatch(/^vol-/)
  })
  it('defaults the prefix to "id"', () => {
    expect(uid()).toMatch(/^id-/)
  })
  it('produces unique values on repeated calls', () => {
    expect(uid('ch')).not.toBe(uid('ch'))
  })
})

describe('indexedDB entity storage', () => {
  it('put then get returns the same record', async () => {
    const ch = chapter()
    await db.put('chapters', ch)
    expect(await db.get('chapters', 'c1')).toEqual(ch)
  })

  it('get on a missing key returns undefined', async () => {
    expect(await db.get('chapters', 'nope')).toBeUndefined()
  })

  it('put with the same id replaces the record', async () => {
    await db.put('volumes', volume())
    const updated = volume({ title: 'B', order: 1, updatedAt: 2 })
    await db.put('volumes', updated)
    expect(await db.get('volumes', 'v1')).toEqual(updated)
  })

  it('getAll returns every record regardless of projectId', async () => {
    await db.put('chapters', chapter({ id: 'c1', projectId: 'p1' }))
    await db.put('chapters', chapter({ id: 'c2', projectId: 'p2' }))
    const all = await db.getAll<ChapterRecord>('chapters')
    expect(all).toHaveLength(2)
  })

  it('getAll on an empty store returns an empty array', async () => {
    expect(await db.getAll('chapters')).toEqual([])
  })

  it('delete removes a record', async () => {
    await db.put('chapters', chapter())
    await db.delete('chapters', 'c1')
    expect(await db.get('chapters', 'c1')).toBeUndefined()
  })

  it('auto-creates both object stores on first open', async () => {
    await db.put('volumes', volume())
    await db.put('chapters', chapter())
    expect(await db.getAll('volumes')).toHaveLength(1)
    expect(await db.getAll('chapters')).toHaveLength(1)
  })
})

// 错误韧性：覆盖 openDB / getAll / get / put / delete 的 onerror reject 分支。
// 这些分支只有在 IndexedDB 自身失败时才会触发，需用桩替换全局 indexedDB 来验证。
describe('indexedDB — 错误韧性（onerror 分支）', () => {
  it('rejects when the database fails to open', async () => {
    const fake = {
      open: () => {
        const req: any = {}
        queueMicrotask(() => {
          req.error = new Error('simulated open failure')
          req.onerror && req.onerror()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: failingDb } = await import('./indexedDB')
    await expect(failingDb.getAll('chapters')).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('rejects read/write operations when a request or transaction errors', async () => {
    const storeReq = (fail: boolean) => {
      const req: any = {}
      queueMicrotask(() => {
        if (fail) {
          req.error = new Error('simulated op failure')
          req.onerror && req.onerror()
        } else {
          req.result = undefined
          req.onsuccess && req.onsuccess()
        }
      })
      return req
    }
    const dbObj: any = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({}),
    }
    const makeTx = (fail: boolean) => {
      const t: any = {
        objectStore: () => ({
          get: () => storeReq(fail),
          getAll: () => storeReq(fail),
          put: () => storeReq(fail),
          delete: () => storeReq(fail),
        }),
        oncomplete: null,
        onerror: null,
      }
      queueMicrotask(() => {
        if (fail) {
          t.error = new Error('simulated tx failure')
          t.onerror && t.onerror()
        } else {
          t.oncomplete && t.oncomplete()
        }
      })
      return t
    }
    dbObj.transaction = () => makeTx(true)
    const fake: any = {
      open: () => {
        const req: any = { result: dbObj }
        queueMicrotask(() => {
          req.onupgradeneeded && req.onupgradeneeded()
          req.onsuccess && req.onsuccess()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: failingDb } = await import('./indexedDB')
    await expect(failingDb.getAll('chapters')).rejects.toThrow()
    await expect(failingDb.get('chapters', 'x')).rejects.toThrow()
    await expect(failingDb.put('chapters', { id: 'x' } as never)).rejects.toThrow()
    await expect(failingDb.delete('chapters', 'x')).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('skips store creation when it already exists and tolerates a falsy getAll result', async () => {
    const storeReq = (result: unknown) => {
      const req: any = {}
      queueMicrotask(() => {
        req.result = result
        req.onsuccess && req.onsuccess()
      })
      return req
    }
    const dbObj: any = {
      // chapters 已存在 -> onupgradeneeded 中跳过创建（覆盖 else 分支）
      objectStoreNames: { contains: (name: string) => name === 'chapters' },
      createObjectStore: () => ({}),
    }
    const makeTx = () => {
      const t: any = {
        objectStore: () => ({
          get: () => storeReq(undefined),
          getAll: () => storeReq(undefined),
          put: () => storeReq(undefined),
          delete: () => storeReq(undefined),
        }),
        oncomplete: null,
        onerror: null,
      }
      queueMicrotask(() => t.oncomplete && t.oncomplete())
      return t
    }
    dbObj.transaction = () => makeTx()
    const fake: any = {
      open: () => {
        const req: any = { result: dbObj }
        queueMicrotask(() => {
          req.onupgradeneeded && req.onupgradeneeded()
          req.onsuccess && req.onsuccess()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: g } = await import('./indexedDB')
    // getAll 成功但结果为 undefined -> 走 `|| []` 回退
    expect(await g.getAll('chapters')).toEqual([])
    expect(await g.get('chapters', 'x')).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('supports CRUD operations on new stores: promiseLedger, timelineNodes, narrativeThreads', async () => {
    await db.put('promiseLedger', { id: 'p1', clueName: 'Test Promise' })
    expect(await db.get('promiseLedger', 'p1')).toEqual({ id: 'p1', clueName: 'Test Promise' })

    await db.put('timelineNodes', { id: 'n1', eventTitle: 'Test Node' })
    expect(await db.get('timelineNodes', 'n1')).toEqual({ id: 'n1', eventTitle: 'Test Node' })

    await db.put('narrativeThreads', { id: 't1', name: 'Main Thread' })
    expect(await db.get('narrativeThreads', 't1')).toEqual({ id: 't1', name: 'Main Thread' })

    await db.delete('promiseLedger', 'p1')
    expect(await db.get('promiseLedger', 'p1')).toBeUndefined()
  })
})
