import { secretStore } from '../adapters/secretStore'
import type { AppSettings, ModelConfig } from './settings'

const OPENAI_CHATGPT_PLAN_USAGE_REF = 'inkpi.model.openai-chatgpt-plan.enabled'

export function modelSecretKey(model: Pick<ModelConfig, 'provider' | 'id'>): string {
  if (model.provider === 'openai-chatgpt-plan') {
    return 'inkpi.model.openai-chatgpt-plan.account'
  }
  return `inkpi.model.${encodeURIComponent(model.provider)}.${encodeURIComponent(model.id)}`
}

function modelCredentialStatusKey(model: Pick<ModelConfig, 'provider' | 'id'>): string {
  return model.provider === 'openai-chatgpt-plan'
    ? OPENAI_CHATGPT_PLAN_USAGE_REF
    : modelSecretKey(model)
}

/** Remove credentials before settings cross the local persistence boundary. */
export function withoutModelSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    aiModel: settings.aiModel ? withoutModelSecret(settings.aiModel) : null,
    savedAiModels: settings.savedAiModels?.map(withoutModelSecret),
  }
}

export async function persistModelSecrets(settings: AppSettings): Promise<void> {
  const models = dedupeModels([
    ...(settings.savedAiModels ?? []),
    ...(settings.aiModel ? [settings.aiModel] : []),
  ])
  await Promise.all(
    models.map(async (model) => {
      const key = modelSecretKey(model)
      if (model.provider !== 'openai-chatgpt-plan' && model.apiKey?.trim()) {
        await secretStore.set(key, model.apiKey.trim())
      }
      return undefined
    }),
  )
}

/** Persist credentials before replacing a legacy settings snapshot with its redacted form. */
export async function migrateModelSecrets(
  settings: AppSettings,
  saveRedactedSettings: (settings: AppSettings) => Promise<void>,
): Promise<void> {
  await persistModelSecrets(settings)
  await saveRedactedSettings(withoutModelSecrets(settings))
}

export async function hydrateModelCredentialStatus(settings: AppSettings): Promise<AppSettings> {
  const models = dedupeModels([
    ...(settings.savedAiModels ?? []),
    ...(settings.aiModel ? [settings.aiModel] : []),
  ])
  const configured = new Set<string>()
  await Promise.all(
    models.map(async (model) => {
      if (await secretStore.has(modelCredentialStatusKey(model))) {
        configured.add(modelSecretKey(model))
      }
      return undefined
    }),
  )
  return {
    ...settings,
    aiModel: settings.aiModel
      ? withCredentialStatus(settings.aiModel, configured.has(modelSecretKey(settings.aiModel)))
      : null,
    savedAiModels: settings.savedAiModels?.map((model) =>
      withCredentialStatus(model, configured.has(modelSecretKey(model))),
    ),
  }
}

function withoutModelSecret(model: ModelConfig): ModelConfig {
  const { apiKey: _apiKey, credentialConfigured: _credentialConfigured, ...safeModel } = model
  return safeModel
}

function withCredentialStatus(model: ModelConfig, configured: boolean): ModelConfig {
  return { ...model, credentialConfigured: configured }
}

function dedupeModels(models: readonly ModelConfig[]): ModelConfig[] {
  const unique = new Map<string, ModelConfig>()
  for (const model of models) unique.set(modelSecretKey(model), model)
  return [...unique.values()]
}
