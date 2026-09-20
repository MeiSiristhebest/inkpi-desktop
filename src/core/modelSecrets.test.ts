import { afterEach, describe, expect, it } from 'vitest'
import type { AppSettings } from './settings'
import {
  hydrateModelSecrets,
  modelSecretKey,
  persistModelSecrets,
  withoutModelSecrets,
} from './modelSecrets'
import { secretStore } from '../adapters/secretStore'

const settings: AppSettings = {
  themeMode: 'system',
  themeSkin: 'default',
  fontFamily: 'serif',
  fontSize: 20,
  lineHeight: '2',
  aiModel: {
    id: 'model-a',
    name: 'Model A',
    provider: 'custom',
    apiKey: 'secret-value',
  },
  savedAiModels: [],
  daemonWsUrl: 'ws://127.0.0.1:8849',
  paragraphIndent: 'full',
  autoSave: true,
  autoSaveDelay: 800,
  wordTarget: 3000,
  normalizePunctuationOnFormat: true,
  defaultTypewriter: false,
  showStatsBar: true,
}

afterEach(async () => {
  await secretStore.remove(modelSecretKey(settings.aiModel!))
})

describe('model SecretStore boundary', () => {
  it('redacts credentials before settings persistence and hydrates them from the session store', async () => {
    const safe = withoutModelSecrets(settings)
    expect(safe.aiModel?.apiKey).toBeUndefined()

    await persistModelSecrets(settings)
    const hydrated = await hydrateModelSecrets(safe)
    expect(hydrated.aiModel?.apiKey).toBe('secret-value')
    expect(JSON.stringify(safe)).not.toContain('secret-value')
  })
})
