/**
 * Secret-free Desktop mirror of the Runtime route DTOs.
 * The Runtime protocol owns the wire contract; this local type surface keeps
 * the Desktop package buildable when its pinned protocol declarations lag the
 * source checkout. Runtime validates every value at the RPC boundary.
 */
export type RuntimeOutputFormat = 'text' | 'structured' | 'patch'
export type RuntimeModelNetworkCapability = 'offline' | 'optional' | 'required'

export interface RuntimeModelRegistrationConfig {
  id: string
  name: string
  provider: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  thinkingBudget?: number
  supportsThinking?: boolean
  supportsMidConvoEffort?: boolean
  supportsPromptCache?: boolean
  presencePenalty?: number
  frequencyPenalty?: number
  cacheControl?: { type: 'ephemeral' | 'disabled' }
}

export interface RuntimeModelRouteCapabilities {
  capabilities?: readonly string[]
  tools?: readonly string[] | boolean
  modalities?: readonly string[]
  network?: RuntimeModelNetworkCapability
  outputFormats?: readonly RuntimeOutputFormat[]
  streaming?: boolean
  contextTokens?: number
  maxLatencyMs?: number
  maxCostUsd?: number
  reasoning?: boolean
  structuredOutput?: boolean
  patchOutput?: boolean
  toolCalling?: boolean
  jsonSchema?: boolean | readonly string[]
  parallelToolCalling?: boolean
  maxContextTokens?: number
  maxOutputTokens?: number
  promptCaching?: boolean
  schemaIds?: readonly string[]
  supportsTools?: boolean
  supportsReasoning?: boolean
  supportsStructuredOutput?: boolean
  supportsPatchOutput?: boolean
  supportsStreaming?: boolean
}

export interface RuntimeModelRouteRanking {
  quality?: number
  latencyMs?: number
  costUsd?: number
  userPreference?: number
}

export interface RuntimeModelRouteRegistration {
  id: string
  model: RuntimeModelRegistrationConfig
  capabilities?: RuntimeModelRouteCapabilities
  priority?: number
  ranking?: RuntimeModelRouteRanking
  fallback?: boolean
}

export interface RuntimeModelSummary {
  id: string
  name: string
  provider: string
  baseUrl?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  thinkingBudget?: number
  supportsThinking?: boolean
  supportsMidConvoEffort?: boolean
  supportsPromptCache?: boolean
  presencePenalty?: number
  frequencyPenalty?: number
  cacheControl?: { type: 'ephemeral' | 'disabled' }
}

export interface RuntimeModelRouteSummary {
  id: string
  model: RuntimeModelSummary
  capabilities?: RuntimeModelRouteCapabilities
  priority?: number
  ranking?: RuntimeModelRouteRanking
  fallback?: boolean
}

export interface RuntimeModelRoutesConfigureResult {
  configured: string[]
  removed: string[]
  routes: RuntimeModelRouteSummary[]
}

export interface RuntimeModelRouteRemoveResult {
  routeId: string
  removed: boolean
  routes: RuntimeModelRouteSummary[]
}

export interface RuntimeModelRouteHealthState {
  availability?: 'available' | 'degraded' | 'unavailable'
  health?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  quota?: { remaining?: number; limit?: number }
  quality?: number
  latencyMs?: number
  costUsd?: number
  userPreference?: number
}

export interface RuntimeModelRouteHealthResult {
  routeId: string
  exists: boolean
  credentialConfigured: boolean
  state: RuntimeModelRouteHealthState
  model?: Pick<RuntimeModelSummary, 'id' | 'provider'>
}
