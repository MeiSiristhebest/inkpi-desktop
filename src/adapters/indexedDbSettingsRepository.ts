import { db } from '../db/indexedDB'
import type { AppSettings } from '../core/settings'
import type { SettingsRepository } from '../ports/settingsRepository'
import { SETTINGS_RECORD_ID } from '../ports/settingsRepository'

/**
 * IndexedDB 设置仓储适配器：作为 localStorage 即时写入之外的持久化镜像，
 * 防止 Tauri WebView 下 localStorage 不可靠导致「关不掉 / 重启又开」。
 */
export const indexedDbSettingsRepository: SettingsRepository = {
  async load() {
    const rec = await db.get<AppSettings & { id: string }>('settings', SETTINGS_RECORD_ID)
    if (!rec) return null
    const { id: _id, ...rest } = rec
    return rest as AppSettings
  },
  async save(settings: AppSettings) {
    await db.put('settings', { id: SETTINGS_RECORD_ID, ...settings })
  },
}
