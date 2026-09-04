import { db } from '../db/indexedDB'
import type { KeyValueStore } from '../ports/keyValueStore'

/**
 * IndexedDB + localStorage 双写键值存储适配器。
 *
 * 同时镜像到 localStorage（同步、跨 tab 即时可见）与 IndexedDB（异步、跨上下文持久），
 * 兼容旧版「localStorage 为主、pluginSettings 表为镜像」的读取路径：get 优先 localStorage，
 * 缺失时回退到 IndexedDB。视图 / 核心层只依赖 KeyValueStore 端口，不直接碰 db 或 localStorage。
 */
const IDB_KV_STORE = 'pluginSettings'
const IDB_KV_MIRROR_ID = 'mirror'

export const indexedDbKeyValueStore: KeyValueStore = {
  async get(key: string): Promise<string | null> {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const raw = localStorage.getItem(key)
      if (raw !== null) return raw
    }
    try {
      const rec = await db.get<{ id: string; value: string }>(IDB_KV_STORE, IDB_KV_MIRROR_ID)
      return rec?.value ?? null
    } catch {
      return null
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(key, value)
      }
    } catch {
      /* localStorage 不可用时降级到 IndexedDB 单源 */
    }
    try {
      await db.put(IDB_KV_STORE, { id: IDB_KV_MIRROR_ID, value })
    } catch {
      /* IndexedDB 写入失败不影响主流程 */
    }
  },
}
