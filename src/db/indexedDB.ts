// 底层实体存储封装
//
// 仅负责 volumes（分卷）与 chapters（章节）两张数据表的读写：
//   - 章节记录字段：id / title / order / wordCount / content / 时间戳(createdAt, updatedAt)
//   - 通过 IndexedDB 在本地持久化，离线可用。
//
// 对外暴露通用 CRUD（getAll / get / put / delete）+ 一个轻量 uid 生成器，
// 供上层组件（WriterDesk / Engine）调用，不直接参与业务编排。

export const DB_NAME = 'inkpi-studio'
export const DB_VERSION = 2

export const STORES = ['volumes', 'chapters', 'codexEntities'] as const
export type StoreName = (typeof STORES)[number]

class InkStudioDB {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' })
            if (name === 'codexEntities' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('category', 'category', { unique: false })
            }
          }
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return this.dbPromise
  }

  public async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as T[]) || [])
      req.onerror = () => reject(req.error)
    })
  }

  public async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  public async put<T>(store: StoreName, value: T): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value as object)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  public async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export const db = new InkStudioDB()

// 轻量唯一 ID：前缀 + 时间基 + 随机串，避免依赖外部库
export const uid = (prefix = 'id'): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
