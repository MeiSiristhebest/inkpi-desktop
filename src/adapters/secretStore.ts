import { invoke } from '@tauri-apps/api/core'
import type { SecretStore } from '../ports/secretStore'

const browserSecrets = new Map<string, string>()

/**
 * Tauri uses the OS credential manager. Browser/dev mode is intentionally
 * session-only: it never falls back to localStorage or IndexedDB.
 */
export const secretStore: SecretStore = {
  async get(key) {
    validateKey(key)
    if (isTauriRuntime()) {
      return invoke<string | null>('secret_store_get', { key })
    }
    return browserSecrets.get(key) ?? null
  },

  async set(key, value) {
    validateKey(key)
    if (!value) {
      await this.remove(key)
      return
    }
    if (isTauriRuntime()) {
      await invoke('secret_store_set', { key, value })
      return
    }
    browserSecrets.set(key, value)
  },

  async remove(key) {
    validateKey(key)
    if (isTauriRuntime()) {
      await invoke('secret_store_remove', { key })
      return
    }
    browserSecrets.delete(key)
  },
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function validateKey(key: string): void {
  if (!key.trim()) throw new Error('SecretStore key must not be empty')
  if (key.length > 256) throw new Error('SecretStore key is too long')
}
