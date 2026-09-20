import { secretStore } from '../adapters/secretStore'
import type { AppSettings, ModelConfig } from './settings'

export function modelSecretKey(model: Pick<ModelConfig, 'provider' | 'id'>): string {
  return `inkpi.model.${encodeURIComponent(model.provider)}.${encodeURIComponent(model.id)}`
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
      if (model.apiKey?.trim()) await secretStore.set(key, model.apiKey.trim())
      else await secretStore.remove(key)
      return undefined
    }),
  )
}

export async function hydrateModelSecrets(settings: AppSettings): Promise<AppSettings> {
  const models = dedupeModels([
    ...(settings.savedAiModels ?? []),
    ...(settings.aiModel ? [settings.aiModel] : []),
  ])
  const secrets = new Map<string, string>()
  await Promise.all(
    models.map(async (model) => {
      const value = await secretStore.get(modelSecretKey(model))
      if (value) secrets.set(modelSecretKey(model), value)
      return undefined
    }),
  )
  return {
    ...settings,
    aiModel: settings.aiModel
      ? withSecret(settings.aiModel, secrets.get(modelSecretKey(settings.aiModel)))
      : null,
    savedAiModels: settings.savedAiModels?.map((model) =>
      withSecret(model, secrets.get(modelSecretKey(model))),
    ),
  }
}

function withoutModelSecret(model: ModelConfig): ModelConfig {
  const { apiKey: _apiKey, ...safeModel } = model
  return safeModel
}

function withSecret(model: ModelConfig, secret: string | undefined): ModelConfig {
  return secret ? { ...model, apiKey: secret } : model
}

function dedupeModels(models: readonly ModelConfig[]): ModelConfig[] {
  const unique = new Map<string, ModelConfig>()
  for (const model of models) unique.set(modelSecretKey(model), model)
  return [...unique.values()]
}
