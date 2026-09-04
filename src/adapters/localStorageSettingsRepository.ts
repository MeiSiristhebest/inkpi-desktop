import type { AppSettings } from '../core/settings'
import type { SettingsRepository } from '../ports/settingsRepository'

/** localStorage 键（与 settings.tsx 共享，单一来源） */
export const SETTINGS_STORAGE_KEY = 'inkpi-settings'

/**
 * 设置仓储适配器：localStorage 即时读写（快速路径）。
 * 仅作持久化的「主存储」，镜像（IndexedDB）由 withMirror 装饰器叠加（§8.2）。
 * 本文件位于 adapters/ 基础设施层，直接触碰 localStorage 合规。
 */
export const localStorageSettingsRepository: SettingsRepository & {
  loadSync(): AppSettings | null
} = {
  loadSync(): AppSettings | null {
    try {
      const raw =
        typeof localStorage !== 'undefined' && localStorage.getItem
          ? localStorage.getItem(SETTINGS_STORAGE_KEY)
          : null
      if (raw) return JSON.parse(raw) as AppSettings
    } catch {
      /* ignore */
    }
    return null
  },
  load() {
    return Promise.resolve(this.loadSync())
  },
  save(settings) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      }
    } catch {
      /* ignore */
    }
    return Promise.resolve()
  },
}
