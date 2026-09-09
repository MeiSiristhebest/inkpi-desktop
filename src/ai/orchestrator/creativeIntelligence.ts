import type {
  AiTask,
  TaskCancelResult,
  TaskResult,
  TaskStatusSnapshot,
  TaskSubmitResult,
} from '@inkpi/protocol'
import {
  ContextCache,
  createDeterministicTaskCacheKey,
  serializeKey,
  type DeterministicTaskCacheKey,
  type TaskCacheKeyDefaults,
} from '../cache'
import {
  ArtifactRuntime,
  IndexedDbArtifactStore,
  type ArtifactIdGenerator,
  type ArtifactPersistenceOptions,
  type ArtifactStore,
} from '../artifacts'
import { CapabilityRouter, type RuntimeRoute, type RouteDecision } from '../routing'
import {
  createContinueTask,
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
  type ContinueTaskInput,
  type ContinuityAuditTaskInput,
  type DeepReasoningTaskInput,
  type DistillationTaskInput,
  type RewriteTaskInput,
} from '../tasks/taskFactories'
import {
  parseContinuityFindings,
  parseDeepReasoning,
  parseDistilledFacts,
  requirePatchResult,
  requireTextResult,
  type ContinuityFinding,
  type DeepReasoningResult,
  type DistilledStoryFacts,
} from '../results/taskResults'

export interface CreativeTaskGateway {
  submitTask(task: AiTask): Promise<TaskSubmitResult>
  getTaskStatus(taskId: string): Promise<TaskStatusSnapshot>
  cancelTask(taskId: string): Promise<TaskCancelResult>
  steerTask?(taskId: string, input: unknown): Promise<{ accepted: boolean }>
  resumeTask?(taskId: string): Promise<TaskSubmitResult>
}

export interface RunTaskOptions {
  signal?: AbortSignal
  pollIntervalMs?: number
  onProgress?: (snapshot: TaskStatusSnapshot) => void
  artifactId?: string
  artifactType?: string
  artifactVersion?: number
  parentArtifactId?: string
  sourceRevision?: number
  sessionId?: string
  executionRunId?: string
}

export interface CreativeIntelligenceOptions extends TaskCacheKeyDefaults {
  cache?: ContextCache<TaskResult>
  modelId?: string
  providerId?: string
  capabilityRouter?: CapabilityRouter
  /** Short alias for callers that already expose a router property. */
  router?: CapabilityRouter
  /** An empty array is an explicit no-route configuration and fails at run time. */
  routes?: RuntimeRoute[]
  artifactStore?: ArtifactStore
  artifactRuntime?: ArtifactRuntime
  /** Accepts the shared IdGenerator port or a deterministic test factory. */
  idGenerator?: ArtifactIdGenerator
  artifactIdGenerator?: ArtifactIdGenerator
}

export class CreativeIntelligence {
  private readonly gateway: CreativeTaskGateway
  private readonly cache: ContextCache<TaskResult>
  private readonly capabilityRouter: CapabilityRouter
  private readonly cacheKeyDefaults: TaskCacheKeyDefaults
  private readonly artifactRuntime: ArtifactRuntime
  private readonly artifactIdGenerator?: ArtifactIdGenerator

  constructor(gateway: CreativeTaskGateway, options: CreativeIntelligenceOptions = {}) {
    this.gateway = gateway
    this.cache = options.cache ?? new ContextCache<TaskResult>()
    this.capabilityRouter =
      options.capabilityRouter ??
      options.router ??
      new CapabilityRouter(
        options.routes === undefined ? [createDefaultGatewayRoute(options)] : options.routes,
      )
    this.cacheKeyDefaults = {
      instruction: options.instruction,
      instructionVersion: options.instructionVersion,
      skill: options.skill,
      skillVersion: options.skillVersion,
      model: options.model ?? options.modelId,
      modelId: options.modelId ?? options.model,
      provider: options.provider ?? options.providerId,
      providerId: options.providerId ?? options.provider,
    }
    this.artifactRuntime =
      options.artifactRuntime ??
      new ArtifactRuntime(options.artifactStore ?? new IndexedDbArtifactStore())
    this.artifactIdGenerator = options.artifactIdGenerator ?? options.idGenerator
  }

  async run(task: AiTask, options: RunTaskOptions = {}): Promise<TaskResult> {
    const decision = this.capabilityRouter.select(task)
    const cacheKey = createDeterministicTaskCacheKey(task, decision.route, this.cacheKeyDefaults)
    const cached = hasArtifactPersistenceOverrides(task, options)
      ? undefined
      : this.cache.get(cacheKey)
    if (cached !== undefined) {
      const cachedResult = decorateResult(task, cached, decision, cacheKey, true)
      if (requiresArtifact(task) && !cachedResult.artifactIds?.length) {
        const persisted = await this.persistArtifact(task, cachedResult, undefined, options)
        this.cache.set(cacheKey, persisted)
        return persisted
      }
      return cachedResult
    }

    const routedTask = attachRouteMetadata(task, decision, cacheKey)
    await this.gateway.submitTask(routedTask)
    const pollIntervalMs = options.pollIntervalMs ?? 100
    while (true) {
      if (options.signal?.aborted) {
        await this.gateway.cancelTask(task.id)
        throw abortError()
      }
      const snapshot = await this.gateway.getTaskStatus(task.id)
      options.onProgress?.(snapshot)
      if (isTerminal(snapshot.status)) {
        const terminalResult = snapshot.result ?? fallbackTerminalResult(task, snapshot)
        if (!terminalResult) throw new Error(`Task ${task.id} ended without a result`)
        const result = decorateResult(task, terminalResult, decision, cacheKey, false)
        const persisted = await this.persistArtifact(task, result, snapshot, options)
        if (persisted.status === 'completed') this.cache.set(cacheKey, persisted)
        return persisted
      }
      await delay(pollIntervalMs, options.signal)
    }
  }

  async runContinue(input: ContinueTaskInput, options: RunTaskOptions = {}): Promise<string> {
    return requireTextResult(await this.run(createContinueTask(input), options))
  }

  async runRewrite(input: RewriteTaskInput, options: RunTaskOptions = {}): Promise<unknown> {
    return requirePatchResult(await this.run(createRewriteTask(input), options))
  }

  async runContinuityAudit(
    input: ContinuityAuditTaskInput,
    options: RunTaskOptions = {},
  ): Promise<ContinuityFinding[]> {
    return parseContinuityFindings(await this.run(createContinuityAuditTask(input), options))
  }

  async runDeepReasoning(
    input: DeepReasoningTaskInput,
    options: RunTaskOptions = {},
  ): Promise<DeepReasoningResult> {
    return parseDeepReasoning(await this.run(createDeepReasoningTask(input), options))
  }

  async runDistillation(
    input: DistillationTaskInput,
    options: RunTaskOptions = {},
  ): Promise<DistilledStoryFacts> {
    return parseDistilledFacts(await this.run(createDistillationTask(input), options))
  }

  async steer(taskId: string, input: unknown): Promise<boolean> {
    if (!this.gateway.steerTask) return false
    return (await this.gateway.steerTask(taskId, input)).accepted
  }

  async resume(taskId: string): Promise<TaskSubmitResult> {
    if (!this.gateway.resumeTask) throw new Error('Task gateway does not support resume')
    return this.gateway.resumeTask(taskId)
  }

  status(taskId: string): Promise<TaskStatusSnapshot> {
    return this.gateway.getTaskStatus(taskId)
  }

  private async persistArtifact(
    task: AiTask,
    result: TaskResult,
    snapshot: TaskStatusSnapshot | undefined,
    options: RunTaskOptions,
  ): Promise<TaskResult> {
    if (
      !requiresArtifact(task) ||
      (result.status !== 'completed' && result.status !== 'waiting-user')
    )
      return result

    const artifactId =
      options.artifactId ?? result.artifactIds?.[0] ?? generateArtifactId(this.artifactIdGenerator)
    const parentArtifactId = options.parentArtifactId ?? readLineageString(task, 'parentArtifactId')
    const sourceRevision = options.sourceRevision ?? readSourceRevision(task)
    const sessionId = options.sessionId ?? readLineageString(task, 'sessionId')
    const executionRunId =
      options.executionRunId ??
      snapshot?.executionRunId ??
      readLineageString(task, 'executionRunId')
    const persistenceOptions: ArtifactPersistenceOptions = {
      ...(options.artifactType ? { type: options.artifactType } : {}),
      ...(options.artifactVersion === undefined ? {} : { version: options.artifactVersion }),
      ...(parentArtifactId ? { parentArtifactId } : {}),
      ...(sourceRevision === undefined ? {} : { sourceRevision }),
      ...(sessionId ? { sessionId } : {}),
      ...(executionRunId ? { executionRunId } : {}),
    }
    const artifact = await this.artifactRuntime.persistTaskResult(
      task,
      result,
      artifactId,
      persistenceOptions,
    )
    if (!artifact) return result
    const artifactIds = uniqueStrings([...(result.artifactIds ?? []), artifact.id])
    return {
      ...result,
      artifactIds,
      provenance: {
        ...(result.provenance || {}),
        ...(executionRunId ? { executionRunId } : {}),
        ...(parentArtifactId ? { parentArtifactId } : {}),
        ...(sourceRevision === undefined ? {} : { sourceRevision }),
        artifactId: artifact.id,
        artifactIds,
        artifactType: artifact.type,
      },
    }
  }
}

const DEFAULT_GATEWAY_CAPABILITIES = [
  'creative-writing',
  'creative-assistant',
  'text-rewrite',
  'continuity-audit',
  'creative-reasoning',
  'creative-distillation',
  'plugin-analysis',
]

function createDefaultGatewayRoute(options: CreativeIntelligenceOptions): RuntimeRoute {
  return {
    id: 'creative-gateway',
    modelId: options.modelId ?? options.model,
    providerId: options.providerId ?? options.provider ?? 'creative-gateway',
    capabilities: DEFAULT_GATEWAY_CAPABILITIES,
    online: true,
    modelCapabilities: {
      streaming: true,
      toolCalling: true,
      patchOutput: true,
      parallelToolCalling: true,
      structuredOutput: true,
      jsonSchema: true,
      reasoning: true,
      promptCaching: true,
      imageInput: true,
      maxContextTokens: Number.MAX_SAFE_INTEGER,
      maxOutputTokens: Number.MAX_SAFE_INTEGER,
    },
    metadata: {
      providerId: options.providerId ?? options.provider ?? 'creative-gateway',
      source: 'creative-intelligence-default',
    },
  }
}

function attachRouteMetadata(
  task: AiTask,
  decision: RouteDecision,
  cacheKey: DeterministicTaskCacheKey,
): AiTask {
  const routeMetadata = decision.route.metadata ? { ...decision.route.metadata } : undefined
  return {
    ...task,
    metadata: {
      ...task.metadata,
      routeId: decision.route.id,
      providerId: cacheKey.provider,
      modelId: cacheKey.model,
      routing: {
        routeId: decision.route.id,
        providerId: cacheKey.provider,
        modelId: cacheKey.model,
        matchedCapabilities: [...decision.matchedCapabilities],
        score: decision.score,
        routeMetadata,
      },
      cache: {
        layer: cacheKey.layer || 'provider',
        key: serializeKey(cacheKey),
      },
    },
  }
}

function decorateResult(
  task: AiTask,
  result: TaskResult,
  decision: RouteDecision,
  cacheKey: DeterministicTaskCacheKey,
  cacheHit: boolean,
): TaskResult {
  const routeMetadata = decision.route.metadata ? { ...decision.route.metadata } : undefined
  return {
    ...result,
    taskId: task.id,
    kind: task.kind,
    provenance: {
      ...(result.provenance || {}),
      routeId: decision.route.id,
      providerId: cacheKey.provider,
      modelId: cacheKey.model,
      matchedCapabilities: [...decision.matchedCapabilities],
      ...(decision.score === undefined ? {} : { routeScore: decision.score }),
      ...(routeMetadata ? { routeMetadata } : {}),
      instruction: cacheKey.instruction,
      skill: cacheKey.skill,
      ...(cacheKey.instructionVersion && result.provenance?.instructionVersion === undefined
        ? { instructionVersion: cacheKey.instructionVersion }
        : {}),
      ...(cacheKey.skillVersion ? { skillVersion: cacheKey.skillVersion } : {}),
      ...(cacheKey.projectRevision === undefined
        ? {}
        : { projectRevision: cacheKey.projectRevision }),
      contextFingerprint: cacheKey.contextFingerprint,
      intentFingerprint: cacheKey.intentFingerprint,
      cacheKey: serializeKey(cacheKey),
      cacheLayer: cacheKey.layer || 'provider',
      cacheHit,
      cache: { hit: cacheHit, key: serializeKey(cacheKey), layer: cacheKey.layer || 'provider' },
      ...(result.artifactIds?.length
        ? { artifactId: result.artifactIds[0], artifactIds: [...result.artifactIds] }
        : {}),
    },
  }
}

function requiresArtifact(task: AiTask): boolean {
  return task.outputContract?.persistence === 'artifact'
}

function hasArtifactPersistenceOverrides(task: AiTask, options: RunTaskOptions): boolean {
  if (!requiresArtifact(task)) return false
  return [
    options.artifactId,
    options.artifactType,
    options.artifactVersion,
    options.parentArtifactId,
    options.sourceRevision,
    options.sessionId,
    options.executionRunId,
  ].some((value) => value !== undefined)
}

function generateArtifactId(generator?: ArtifactIdGenerator): string | undefined {
  if (!generator) return undefined
  return typeof generator === 'function' ? generator('artifact') : generator.generate('artifact')
}

function readLineageString(task: AiTask, key: string): string | undefined {
  const metadata = asRecord(task.metadata)
  const lineage = asRecord(metadata?.lineage)
  const payload = asRecord(task.input.payload)
  const payloadLineage = asRecord(payload?.lineage)
  return firstString(metadata?.[key], lineage?.[key], payload?.[key], payloadLineage?.[key])
}

function readSourceRevision(task: AiTask): number | undefined {
  const metadata = asRecord(task.metadata)
  const lineage = asRecord(metadata?.lineage)
  const payload = asRecord(task.input.payload)
  const payloadLineage = asRecord(payload?.lineage)
  const context = asRecord(payload?.context)
  const contextMetadata = asRecord(task.contextPolicy?.metadata)
  return firstNumber(
    metadata?.sourceRevision,
    lineage?.sourceRevision,
    payload?.sourceRevision,
    payloadLineage?.sourceRevision,
    task.input.selection?.revision,
    metadata?.projectRevision,
    contextMetadata?.projectRevision,
    context?.revision,
    context?.projectRevision,
  )
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function fallbackTerminalResult(
  task: AiTask,
  snapshot: TaskStatusSnapshot,
): TaskResult | undefined {
  if (
    snapshot.status !== 'waiting-user' &&
    snapshot.status !== 'failed' &&
    snapshot.status !== 'cancelled'
  )
    return undefined
  return {
    taskId: task.id,
    kind: task.kind,
    status: snapshot.status,
    ...(snapshot.error ? { error: snapshot.error } : {}),
  }
}

function isTerminal(status: TaskStatusSnapshot['status']): boolean {
  return (
    status === 'waiting-user' ||
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled'
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(abortError())
      },
      { once: true },
    )
  })
}

function abortError(): Error {
  const error = new Error('Creative task was cancelled')
  error.name = 'AbortError'
  return error
}
