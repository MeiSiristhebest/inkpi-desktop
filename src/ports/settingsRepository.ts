import type { AppSettings } from '../core/settings'

/** 设置仓储端口（抽象）。持久化实现可替换为 IndexedDB / localStorage / 远端配置中心。 */
export const SETTINGS_RECORD_ID = 'app'

export interface SettingsRepository {
  /** 读取已持久化的设置；无记录时返回 null（交由调用方回退到默认值） */
  load(): Promise<AppSettings | null>
  save(settings: AppSettings): Promise<void>
}
