import { db } from '../db/indexedDB'

export interface SettingsKVRecord<T = unknown> {
  key: string
  value: T
}

export class IndexedDbSettingsKVRepository {
  async get<T>(projectId: string, keyName: string, defaultValue: T): Promise<T> {
    const fullKey = `${projectId}::${keyName}`
    const record = await db.get<SettingsKVRecord<T>>('settingsKV', fullKey)
    return record?.value ?? defaultValue
  }

  async set<T>(projectId: string, keyName: string, value: T): Promise<void> {
    const fullKey = `${projectId}::${keyName}`
    await db.put('settingsKV', {
      key: fullKey,
      value,
    })
  }

  async remove(projectId: string, keyName: string): Promise<void> {
    await db.delete('settingsKV', `${projectId}::${keyName}`)
  }
}

export const indexedDbSettingsKVRepository = new IndexedDbSettingsKVRepository()
