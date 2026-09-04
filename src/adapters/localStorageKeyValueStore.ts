import type { KeyValueStore } from '../ports/keyValueStore'

/**
 * localStorage 同步适配器（KeyValueStore 端口的轻量实现）。
 *
 * 用于 editor canvas-width、excluded-numbering-ids、chapter-history、
 * scratchpad 等轻量 UI 偏好，读写均同步完成。
 * 业务层依赖 KeyValueStore 端口，不感知底层是 localStorage 还是其他存储。
 */
export const localStorageKeyValueStore: KeyValueStore & {
  getSync(key: string): string | null
  hasKeySync(key: string): boolean
} = {
  getSync(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem
        ? localStorage.getItem(key)
        : null
    } catch {
      return null
    }
  },
  hasKeySync(key: string): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem
        ? localStorage.getItem(key) !== null
        : false
    } catch {
      return false
    }
  },
  async get(key: string): Promise<string | null> {
    return this.getSync(key)
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(key, value)
      }
    } catch {
      /* ignore */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem(key)
      }
    } catch {
      /* ignore */
    }
  },
}
