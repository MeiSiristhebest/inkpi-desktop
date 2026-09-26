import { PROVIDER_META, type AppSettings } from '../../core/settings'

/**
 * 连接页的三组状态词表（收口计划 P1.18）。
 *
 * 过去一个 `connected` 布尔同时被用来表达「Daemon 在线」「AI 能用」「供应商可达」，
 * 于是设置页可以恒定亮绿。这里把三者拆开，并且每一种都允许「未知」——
 * 没有真实信号时如实显示未知，比伪造绿色更接近 INV-09。
 */
export type RuntimeReadiness = 'online' | 'connecting' | 'offline' | 'unknown'
export type AiReadiness = 'ready' | 'degraded' | 'unavailable'
export type ProviderReadiness = 'probing' | 'healthy' | 'auth-error' | 'unreachable' | 'unknown'

/**
 * Daemon 的两个布尔 → Runtime 三态。
 * 两个信号都没接（宿主未透传）时返回 unknown，而不是替用户猜一个「离线」。
 */
export function deriveRuntimeReadiness(signal: {
  isConnected?: boolean
  isReconnecting?: boolean
}): RuntimeReadiness {
  if (signal.isConnected === undefined && signal.isReconnecting === undefined) return 'unknown'
  if (signal.isConnected) return 'online'
  if (signal.isReconnecting) return 'connecting'
  return 'offline'
}

/**
 * 生效中的模型绑定 → AI 可用性。只看用户真实配了什么：
 * 内置 Faux 夹具不联网；本地 Ollama 无需密钥；其余远端协议缺地址或密钥即降级。
 */
export function deriveAiReadiness(settings: Pick<AppSettings, 'aiModel'>): AiReadiness {
  const model = settings.aiModel
  if (!model || model.enabled === false) return 'unavailable'

  const meta = PROVIDER_META[model.provider]
  if (meta?.streamKind === 'faux') return 'ready'

  const baseUrl = model.baseUrl?.trim() || meta?.defaultBaseUrl?.trim()
  if (!baseUrl) return 'degraded'
  if (meta?.streamKind !== 'ollama' && !model.apiKey?.trim()) return 'degraded'
  return 'ready'
}

/** HTTP 响应码 → 供应商可达性。401/403 是凭据问题，不是断网。 */
export function classifyProbeStatus(
  status: number,
): Exclude<ProviderReadiness, 'probing' | 'unknown'> {
  if (status === 401 || status === 403) return 'auth-error'
  if (status >= 200 && status < 400) return 'healthy'
  return 'unreachable'
}
