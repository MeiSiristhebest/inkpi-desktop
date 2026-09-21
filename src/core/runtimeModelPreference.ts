import type {
  RuntimeModelRegistrationConfig,
  RuntimeModelRouteRegistration,
} from '../ports/runtimeModelRoutes'
import type { ModelConfig } from './settings'

/**
 * 用户“选择哪个模型驱动 Runtime”的运行时偏好快照。
 *
 * 与 Secret 存储分离：SecretStore 只负责把 API Key 安全存好；这里是运行时路由
 * 的“最后一步”——把用户当前选定的模型（provider/model id）注入到发往 Daemon 的
 * AiTask.metadata.modelRoute，让 Runtime 的 model-capability-router 据此选择真实
 * 模型。偏好通过已可序列化的 metadata 传输，不改任务协议结构。
 */
export interface RuntimeModelPreference {
  providerId: string
  modelId: string
}

let current: RuntimeModelPreference | undefined
let currentRoutes: RuntimeModelRouteRegistration[] = []

/** 由 Settings Provider 在 aiModel 变化时同步。null/undefined 清除偏好（回退到 Runtime 默认）。 */
export function setRuntimeModelPreference(model: ModelConfig | null | undefined): void {
  if (!model || !model.provider || !model.id) {
    current = undefined
    return
  }
  current = { providerId: model.provider, modelId: model.id }
}

/** 读取当前选定的模型偏好（供 adapter / task 构建器附加到 metadata.modelRoute）。 */
export function getRuntimeModelPreference(): RuntimeModelPreference | undefined {
  return current
}

/**
 * Keep the Runtime route catalog in memory only. The adapter sends this
 * snapshot to the Runtime when the first task is submitted; settings
 * persistence remains secret-free and the Runtime response is secret-free.
 */
export function setRuntimeModelRoutes(
  models: readonly ModelConfig[] | undefined,
  activeModel: ModelConfig | null | undefined,
): void {
  const byKey = new Map<string, ModelConfig>()
  for (const model of [...(models ?? []), ...(activeModel ? [activeModel] : [])]) {
    if (!model.id.trim() || !model.provider || model.enabled === false) continue
    byKey.set(`${model.provider}\u0000${model.id}`, model)
  }

  currentRoutes = [...byKey.values()].map((model) => createRuntimeModelRoute(model, activeModel))
}

/** Read a defensive in-memory copy for the daemon adapter. */
export function getRuntimeModelRoutes(): readonly RuntimeModelRouteRegistration[] {
  return currentRoutes.map((route) => ({
    ...route,
    model: { ...route.model },
    ...(route.capabilities ? { capabilities: { ...route.capabilities } } : {}),
  }))
}

function createRuntimeModelRoute(
  model: ModelConfig,
  activeModel: ModelConfig | null | undefined,
): RuntimeModelRouteRegistration {
  const isActive = activeModel?.id === model.id && activeModel.provider === model.provider
  const contextTokens = positiveNumber(model.contextWindow)
  const maxOutputTokens = positiveNumber(model.maxTokens)
  const baseUrl = model.baseUrl?.trim() || undefined
  const provider = model.provider
  const offline = provider === 'ollama' || isLocalUrl(baseUrl)
  const supportsReasoning =
    model.supportsThinking === true ||
    (model.thinkingLevel !== undefined && model.thinkingLevel !== 'none')

  const runtimeModel: RuntimeModelRegistrationConfig = {
    id: model.id.trim(),
    name: model.name?.trim() || model.id.trim(),
    provider,
    ...(model.apiKey?.trim() ? { apiKey: model.apiKey.trim() } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(positiveNumber(model.maxTokens) ? { maxTokens: model.maxTokens } : {}),
    ...(finiteNumber(model.temperature) ? { temperature: model.temperature } : {}),
    ...(finiteNumber(model.topP) ? { topP: model.topP } : {}),
    ...(finiteNumber(model.presencePenalty) ? { presencePenalty: model.presencePenalty } : {}),
    ...(finiteNumber(model.frequencyPenalty) ? { frequencyPenalty: model.frequencyPenalty } : {}),
    ...(finiteNumber(model.thinkingBudget) ? { thinkingBudget: model.thinkingBudget } : {}),
    ...(typeof model.supportsThinking === 'boolean'
      ? { supportsThinking: model.supportsThinking }
      : {}),
    ...(typeof model.supportsPromptCache === 'boolean'
      ? { supportsPromptCache: model.supportsPromptCache }
      : {}),
  }

  return {
    id: `desktop:${encodeURIComponent(provider)}:${encodeURIComponent(model.id.trim())}`,
    model: runtimeModel,
    capabilities: {
      capabilities: ['*'],
      tools: true,
      toolCalling: true,
      modalities: model.supportsImages ? ['text', 'image'] : ['text'],
      network: offline ? 'offline' : 'required',
      outputFormats: ['text', 'structured', 'patch'],
      streaming: true,
      reasoning: supportsReasoning,
      structuredOutput: true,
      patchOutput: true,
      jsonSchema: true,
      promptCaching: model.supportsPromptCache === true,
      ...(contextTokens ? { contextTokens, maxContextTokens: contextTokens } : {}),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
    },
    priority: isActive ? 100 : 0,
    fallback: false,
  }
}

function positiveNumber(value: number | undefined): number | undefined {
  return finiteNumber(value) && value > 0 ? value : undefined
}

function finiteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}

function isLocalUrl(value: string | undefined): boolean {
  return /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|::1)(?::\d+)?(?:\/|$)/i.test(
    value ?? '',
  )
}
