import { invoke } from '@tauri-apps/api/core'
import type { SecretStore } from '../ports/secretStore'

const browserSecrets = new Map<string, string>()

/**
 * Tauri uses the OS credential manager. Browser/dev mode is intentionally
 * session-only: it never falls back to localStorage or IndexedDB.
 */
export const secretStore: SecretStore = {
  async has(key) {
    validateKey(key)
    if (isTauriRuntime()) {
      return invoke<boolean>('secret_store_has', { key })
    }
    return browserSecrets.has(key)
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
  if (!key.startsWith('inkpi.model.') || key.length <= 'inkpi.model.'.length || key.length > 256) {
    throw new Error('SecretStore key must be a valid InkPi model credential reference')
  }
  if (
    [...key].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    throw new Error('SecretStore key must not contain control characters')
  }
}
