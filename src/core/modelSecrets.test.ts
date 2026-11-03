import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from './settings'
import {
  hydrateModelCredentialStatus,
  migrateModelSecrets,
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
  vi.restoreAllMocks()
  await secretStore.remove(modelSecretKey(settings.aiModel!))
})

describe('model SecretStore boundary', () => {
  it('redacts credentials and hydrates only their configured status', async () => {
    const safe = withoutModelSecrets(settings)
    expect(safe.aiModel?.apiKey).toBeUndefined()

    await persistModelSecrets(settings)
    const hydrated = await hydrateModelCredentialStatus(safe)
    expect(hydrated.aiModel?.apiKey).toBeUndefined()
    expect(hydrated.aiModel?.credentialConfigured).toBe(true)
    expect(JSON.stringify(safe)).not.toContain('secret-value')
  })

  it('uses separate opaque credential references for the same model on different ChatGPT accounts', async () => {
    const firstAccount = {
      id: 'gpt-5.3-codex',
      name: 'GPT 5.3 Codex',
      provider: 'openai-chatgpt-plan' as const,
      accountId: 'account-a',
      apiKey: 'must-not-be-persisted',
    }
    const secondAccount = { ...firstAccount, accountId: 'account-b' }
    const firstRef = modelSecretKey(firstAccount)
    const secondRef = modelSecretKey(secondAccount)
    const hasSpy = vi.spyOn(secretStore, 'has').mockResolvedValue(false)
    const setSpy = vi.spyOn(secretStore, 'set').mockResolvedValue(undefined)

    expect(firstRef).toBe('inkpi.model.openai-chatgpt-plan.account.account-a')
    expect(secondRef).toBe('inkpi.model.openai-chatgpt-plan.account.account-b')
    expect(firstRef).not.toBe(secondRef)
    await persistModelSecrets({
      ...settings,
      aiModel: firstAccount,
      savedAiModels: [secondAccount],
    })
    await hydrateModelCredentialStatus({
      ...settings,
      aiModel: null,
      savedAiModels: [firstAccount, secondAccount],
    })

    expect(setSpy).not.toHaveBeenCalled()
    expect(hasSpy).toHaveBeenCalledWith(firstRef)
    expect(hasSpy).toHaveBeenCalledWith(secondRef)
  })

  it('keeps Codex OAuth account references separate and never persists OAuth tokens as API keys', async () => {
    const firstAccount = {
      id: 'gpt-6.1-terra',
      name: 'GPT-6.1 Terra',
      provider: 'openai-codex' as const,
      accountId: 'codex-account-a',
      apiKey: 'must-not-be-persisted',
    }
    const secondAccount = { ...firstAccount, accountId: 'codex-account-b' }
    const firstRef = modelSecretKey(firstAccount)
    const secondRef = modelSecretKey(secondAccount)
    const hasSpy = vi.spyOn(secretStore, 'has').mockResolvedValue(false)
    const setSpy = vi.spyOn(secretStore, 'set').mockResolvedValue(undefined)

    expect(firstRef).toBe('inkpi.model.openai-codex.account.codex-account-a')
    expect(secondRef).toBe('inkpi.model.openai-codex.account.codex-account-b')
    expect(firstRef).not.toBe(secondRef)
    expect(firstRef).not.toBe(modelSecretKey({ ...firstAccount, provider: 'openai-chatgpt-plan' }))

    await persistModelSecrets({
      ...settings,
      aiModel: firstAccount,
      savedAiModels: [secondAccount],
    })
    await hydrateModelCredentialStatus({
      ...settings,
      aiModel: null,
      savedAiModels: [firstAccount, secondAccount],
    })

    expect(setSpy).not.toHaveBeenCalled()
    expect(hasSpy).toHaveBeenCalledWith(firstRef)
    expect(hasSpy).toHaveBeenCalledWith(secondRef)
  })

  it('does not remove a stored credential when a redacted settings snapshot is saved', async () => {
    const key = modelSecretKey(settings.aiModel!)
    await secretStore.set(key, 'existing-secret')

    await persistModelSecrets(withoutModelSecrets(settings))

    await expect(secretStore.has(key)).resolves.toBe(true)
  })

  it('does not save a redacted migration snapshot when credential persistence fails', async () => {
    vi.spyOn(secretStore, 'set').mockRejectedValueOnce(new Error('credential store unavailable'))
    const saveRedactedSettings = vi.fn(async () => undefined)

    await expect(migrateModelSecrets(settings, saveRedactedSettings)).rejects.toThrow(
      'credential store unavailable',
    )
    expect(saveRedactedSettings).not.toHaveBeenCalled()
  })

  it('writes the credential before saving the redacted migration snapshot', async () => {
    const key = modelSecretKey(settings.aiModel!)
    const saveRedactedSettings = vi.fn(async () => {
      await expect(secretStore.has(key)).resolves.toBe(true)
    })

    await migrateModelSecrets(settings, saveRedactedSettings)

    expect(saveRedactedSettings).toHaveBeenCalledWith(withoutModelSecrets(settings))
  })
})
