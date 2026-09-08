import type { AiTask } from '@inkpi/protocol'

export interface ModelCapabilities {
  streaming: boolean
  toolCalling: boolean
  parallelToolCalling?: boolean
  structuredOutput: boolean
  jsonSchema: boolean
  reasoning: boolean
  promptCaching: boolean
  imageInput?: boolean
  maxContextTokens: number
  maxOutputTokens: number

  // Compatibility aliases for older route declarations.
  text?: boolean
  patchOutput?: boolean
  tools?: boolean
  vision?: boolean
  offline?: boolean
  quality?: number
  latencyMs?: number
  costUsdPerMillionTokens?: number
}

export interface RuntimeRoute {
  id: string
  capabilities: string[]
  online: boolean
  priority?: number
  modelId?: string
  modelCapabilities?: ModelCapabilities
  metadata?: Record<string, unknown>
}

export interface RouteDecision {
  route: RuntimeRoute
  matchedCapabilities: string[]
  score?: number
}

export class NoCapableRouteError extends Error {
  constructor(task: AiTask) {
    super(`No runtime route satisfies task requirements: ${task.kind}`)
    this.name = 'NoCapableRouteError'
  }
}

export class CapabilityRouter {
  private routes: RuntimeRoute[]

  constructor(routes: RuntimeRoute[] = []) {
    this.routes = routes.map(cloneRoute)
  }

  setRoutes(routes: RuntimeRoute[]): void {
    this.routes = routes.map(cloneRoute)
  }

  listRoutes(): RuntimeRoute[] {
    return this.routes.map(cloneRoute)
  }

  select(task: AiTask): RouteDecision {
    const required = task.requirements?.capabilities || []
    const network = task.requirements?.network || 'optional'
    const outputFormats = task.requirements?.outputFormats || (task.outputContract ? [task.outputContract.format] : [])
    const candidates = this.routes
      .filter((route) => network !== 'required' || route.online)
      .filter((route) => network !== 'offline' || route.modelCapabilities?.offline === true || !route.modelCapabilities)
      .filter((route) => satisfiesModel(route, task, outputFormats))
      .map((route) => ({ route, matchedCapabilities: required.filter((capability) => route.capabilities.includes(capability)) }))
      .filter(({ matchedCapabilities }) => matchedCapabilities.length === required.length)
      .map((candidate) => ({ ...candidate, score: routeScore(candidate.route) }))
      .sort((left, right) => {
        const priorityDelta = (right.score ?? 0) - (left.score ?? 0)
        return priorityDelta || left.route.id.localeCompare(right.route.id)
      })
    const selected = candidates[0]
    if (!selected) throw new NoCapableRouteError(task)
    return { route: cloneRoute(selected.route), matchedCapabilities: [...selected.matchedCapabilities], score: selected.score }
  }
}

function cloneRoute(route: RuntimeRoute): RuntimeRoute {
  return {
    ...route,
    capabilities: [...route.capabilities],
    metadata: route.metadata ? { ...route.metadata } : undefined,
    modelCapabilities: route.modelCapabilities ? { ...route.modelCapabilities } : undefined,
  }
}

function satisfiesModel(route: RuntimeRoute, task: AiTask, outputFormats: string[]): boolean {
  const capabilities = route.modelCapabilities
  if (!capabilities) return true
  const requirements = task.requirements
  if ((requirements?.streaming === true || requirements?.needsStreaming === true) && capabilities.streaming !== true) return false
  if ((task.executionPolicy?.strategy === 'reasoning' || requirements?.needsReasoning === true) && capabilities.reasoning !== true) return false
  if ((requirements?.tools?.length || requirements?.needsTools === true) && capabilities.toolCalling !== true && capabilities.tools !== true) return false
  if (requirements?.needsStructuredOutput === true && capabilities.structuredOutput !== true) return false
  if (requirements?.modalities?.includes('vision') && capabilities.imageInput !== true && capabilities.vision !== true) return false
  const minimumContext = requirements?.minContextTokens ?? requirements?.minimumContext
  if (minimumContext !== undefined && capabilities.maxContextTokens < minimumContext) return false
  if (requirements?.maxLatencyMs !== undefined && capabilities.latencyMs !== undefined && capabilities.latencyMs > requirements.maxLatencyMs) return false
  if (requirements?.maxCostUsd !== undefined && capabilities.costUsdPerMillionTokens !== undefined && capabilities.costUsdPerMillionTokens > requirements.maxCostUsd) return false
  return outputFormats.every((format) =>
    format === 'text'
      ? capabilities.text !== false
      : format === 'structured'
        ? capabilities.structuredOutput === true &&
          (task.outputContract?.schemaId === undefined || capabilities.jsonSchema === true)
        : capabilities.patchOutput === true)
}

function routeScore(route: RuntimeRoute): number {
  const quality = route.modelCapabilities?.quality ?? 0
  const latency = route.modelCapabilities?.latencyMs ?? 0
  const latencyBonus = latency > 0 ? 1 / latency : 0
  return (route.priority ?? 0) * 1_000 + quality * 10 + latencyBonus
}
