import type { ModelConfig } from '../../core/settings'
import type { RuntimeRoute, ModelCapabilities } from './capabilityRouter'

/**
 * 将用户在设置中心保存的 ModelConfig 转换为 CapabilityRouter 识别的 RuntimeRoute。
 *
 * 规则：
 * 1. 自动识别模型特征：
 *    - 含有 'r1', 'o1', 'o3', 'reasoner', 'thinking' 等关键词，或 supportsThinking=true 时，启用 reasoning 能力；
 *    - 上下文窗口优先从 contextWindow，否则根据模型 ID 启发式默认（如 64k/128k）；
 *    - 默认开启 streaming, structuredOutput, text, patchOutput 等创作基础能力。
 * 2. 区分默认模型与备选模型：
 *    - 默认模型（active/default）赋予更高的 priority 优先级加权；
 *    - 启用的模型（enabled !== false）方可参与路由。
 */
export function modelConfigToRoute(
  config: ModelConfig,
  isDefault: boolean = false,
  priorityOffset: number = 0,
): RuntimeRoute {
  const modelIdLower = config.id.toLowerCase()
  const nameLower = (config.name || '').toLowerCase()

  const isReasoningModel =
    Boolean(config.supportsThinking) ||
    (config.thinkingLevel !== undefined && config.thinkingLevel !== 'none') ||
    modelIdLower.includes('reasoner') ||
    modelIdLower.includes('r1') ||
    modelIdLower.includes('o1') ||
    modelIdLower.includes('o3') ||
    modelIdLower.includes('thinking') ||
    nameLower.includes('reasoner') ||
    nameLower.includes('thinking')

  const isPromptCacheSupported =
    Boolean(config.supportsPromptCache) ||
    modelIdLower.includes('deepseek') ||
    modelIdLower.includes('claude-3') ||
    modelIdLower.includes('gpt-4o')

  const contextWindow =
    config.contextWindow ??
    (modelIdLower.includes('200k')
      ? 200000
      : modelIdLower.includes('1m')
        ? 1000000
        : modelIdLower.includes('128k') ||
            modelIdLower.includes('deepseek') ||
            modelIdLower.includes('gpt-4o')
          ? 128000
          : modelIdLower.includes('32k')
            ? 32000
            : 64000)

  const capabilities: string[] = [
    'creative-writing',
    'creative-assistant',
    'text-rewrite',
    'text',
    'continuity-audit',
    'creative-distillation',
  ]

  if (isReasoningModel) {
    capabilities.push('creative-reasoning', 'reasoning')
  }

  const modelCapabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    jsonSchema: true,
    reasoning: isReasoningModel,
    promptCaching: isPromptCacheSupported,
    imageInput: Boolean(config.supportsImages),
    maxContextTokens: contextWindow,
    maxOutputTokens: config.maxTokens ?? 4096,
    text: true,
    patchOutput: true,
    tools: true,
    offline: config.provider === 'ollama' || config.provider === 'custom',
    quality: isReasoningModel ? 95 : isDefault ? 90 : 80,
  }

  // 默认模型拥有更高基础优先级
  const basePriority = isDefault ? 100 : 50
  const priority = basePriority + priorityOffset

  return {
    id: `${config.provider}::${config.id}`,
    capabilities,
    online: config.provider !== 'ollama',
    priority,
    providerId: config.provider,
    provider: config.provider,
    modelId: config.id,
    model: config.id,
    modelCapabilities,
    metadata: {
      name: config.name,
      alias: config.alias,
      baseUrl: config.baseUrl,
      thinkingLevel: config.thinkingLevel,
      isDefault,
    },
  }
}

export function buildRoutesFromModelConfigs(
  savedModels: ModelConfig[] = [],
  activeModel: ModelConfig | null = null,
): RuntimeRoute[] {
  const routes: RuntimeRoute[] = []
  const seenKeys = new Set<string>()

  // 1. 如果有活跃的默认模型且有效，排在首位
  if (activeModel && activeModel.enabled !== false) {
    const defaultRoute = modelConfigToRoute(activeModel, true, 20)
    routes.push(defaultRoute)
    seenKeys.add(`${activeModel.provider}::${activeModel.id}`)
  }

  // 2. 遍历其它已保存且启用的模型
  let offset = 0
  for (const model of savedModels) {
    if (model.enabled === false) continue
    const key = `${model.provider}::${model.id}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    routes.push(modelConfigToRoute(model, false, -offset))
    offset += 1
  }

  return routes
}
