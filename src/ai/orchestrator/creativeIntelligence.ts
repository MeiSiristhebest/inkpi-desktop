import type {
  AiTask,
  TaskCancelResult,
  TaskExecutionSnapshot,
  TaskResult,
  TaskStatus,
  TaskStatusSnapshot,
  TaskSubmitResult,
} from '@inkpi/protocol'
import {
  ContextCache,
  createDeterministicTaskCacheKey,
  LayeredContextCache,
  serializeKey,
  SharedCacheMetrics,
  type SharedCacheMetricsPort,
  type SharedCacheMetricsSnapshot,
  type ContextCacheKey,
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
  getTaskExecution?(taskId: string): Promise<TaskExecutionSnapshot>
  cancelTask(taskId: string): Promise<TaskCancelResult>
  steerTask?(taskId: string, input: unknown): Promise<{ accepted: boolean }>
  resumeTask?(taskId: string): Promise<TaskSubmitResult>
}

export interface RunTaskOptions {
  signal?: AbortSignal
  pollIntervalMs?: number
  /** Maximum time spent waiting for a terminal task result. */
  timeoutMs?: number
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
  /** A provider-only cache or the shared three-layer cache compatibility entry. */
  cache?: ContextCache<TaskResult> | LayeredContextCache<TaskResult>
  /** Shared three-layer cache. The provider layer is used for task results. */
  layeredCache?: LayeredContextCache<unknown>
  cacheMetrics?: SharedCacheMetricsPort
  /** Alias for callers that share the metrics port across cache layers. */
  sharedCacheMetrics?: SharedCacheMetricsPort
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

interface InFlightTask {
  identityKey: string
  promise: Promise<TaskResult>
}

export class CreativeIntelligence {
  private readonly gateway: CreativeTaskGateway
  private readonly cache: ContextCache<TaskResult>
  private readonly layeredCache?: LayeredContextCache<unknown>
  private readonly cacheMetrics: SharedCacheMetricsPort
  private readonly cachedRevisions = new Map<string, number | undefined>()
  private readonly capabilityRouter: CapabilityRouter
  private readonly cacheKeyDefaults: TaskCacheKeyDefaults
  private readonly artifactRuntime: ArtifactRuntime
  private readonly artifactIdGenerator?: ArtifactIdGenerator
  private readonly inFlightTasks = new Map<string, InFlightTask>()

  constructor(gateway: CreativeTaskGateway, options: CreativeIntelligenceOptions = {}) {
    const compatibilityLayeredCache = isLayeredContextCache(options.cache)
      ? options.cache
      : undefined
    this.gateway = gateway
    this.layeredCache =
      options.layeredCache ??
      compatibilityLayeredCache ??
      (options.cache ? undefined : new LayeredContextCache<unknown>())
    this.cache = this.layeredCache
      ? (this.layeredCache.provider as unknown as ContextCache<TaskResult>)
      : ((options.cache as ContextCache<TaskResult> | undefined) ?? new ContextCache<TaskResult>())
    this.cacheMetrics =
      options.cacheMetrics ?? options.sharedCacheMetrics ?? new SharedCacheMetrics()
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

  run(task: AiTask, options: RunTaskOptions = {}): Promise<TaskResult> {
    const identityKey = serializeTaskIdentity(task)
    const existing = this.inFlightTasks.get(task.id)
    if (existing) {
      if (existing.identityKey !== identityKey) {
        return Promise.reject(new Error(`Task ${task.id} is already running with a different identity`))
      }
      return awaitWithAbort(existing.promise, options.signal)
    }

    const promise = this.execute(task, options)
    const entry = { identityKey, promise }
    this.inFlightTasks.set(task.id, entry)
    void promise.then(
      () => {
        if (this.inFlightTasks.get(task.id) === entry) this.inFlightTasks.delete(task.id)
      },
      () => {
        if (this.inFlightTasks.get(task.id) === entry) this.inFlightTasks.delete(task.id)
      },
    )
    return promise
  }

  private async execute(task: AiTask, options: RunTaskOptions): Promise<TaskResult> {
    if (options.signal?.aborted) throw abortError()
    const decision = this.capabilityRouter.select(task)
    const cacheKey = createDeterministicTaskCacheKey(task, decision.route, this.cacheKeyDefaults)
    this.invalidateLayeredRevisions(cacheKey.projectRevision)
    const effectiveTask = this.touchLayeredCaches(task, cacheKey)
    const cacheReadDisabled = hasArtifactPersistenceOverrides(task, options)
    const cached = cacheReadDisabled ? undefined : this.readCached(effectiveTask, cacheKey)
    if (cached !== undefined) {
      const cachedResult = decorateResult(effectiveTask, cached, decision, cacheKey, true)
      if (requiresArtifact(task) && !cachedResult.artifactIds?.length) {
        const persisted = await this.persistArtifact(
          effectiveTask,
          cachedResult,
          undefined,
          options,
        )
        this.writeCached(effectiveTask, cacheKey, persisted)
        return persisted
      }
      return cachedResult
    }

    const routedTask = attachRouteMetadata(effectiveTask, decision, cacheKey)
    const timeoutMs = resolveTaskTimeout(task, options.timeoutMs)
    const deadline = Date.now() + timeoutMs

    let submissionStarted = false
    try {
      submissionStarted = true
      const submitResult = await callWithDeadline(
        () => this.gateway.submitTask(routedTask),
        deadline,
        taskTimeoutError(task.id, timeoutMs),
        options.signal,
      )
      assertTaskSubmitResult(submitResult, task)
      const pollIntervalMs = options.pollIntervalMs ?? 100
      while (true) {
        if (options.signal?.aborted) throw abortError()
        if (Date.now() >= deadline) throw taskTimeoutError(task.id, timeoutMs)
        const snapshot = await callWithDeadline(
          () => this.gateway.getTaskStatus(task.id),
          deadline,
          taskTimeoutError(task.id, timeoutMs),
          options.signal,
        )
        assertTaskStatusSnapshot(snapshot, task)
        options.onProgress?.(snapshot)
        if (isTerminal(snapshot.status)) {
          const terminalResult = snapshot.result ?? fallbackTerminalResult(effectiveTask, snapshot)
          if (!terminalResult) throw new Error(`Task ${task.id} ended without a result`)
          const result = decorateResult(effectiveTask, terminalResult, decision, cacheKey, false)
          const persisted = await this.persistArtifact(effectiveTask, result, snapshot, options)
          if (persisted.status === 'completed') this.writeCached(effectiveTask, cacheKey, persisted)
          return persisted
        }
        await delay(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())), options.signal)
      }
    } catch (error: unknown) {
      if (submissionStarted && (isAbortError(error) || isTimeoutError(error))) {
        await cancelAfterTimeout(this.gateway, task.id)
      }
      throw error
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
    const result = await this.gateway.resumeTask(taskId)
    if (result?.taskId !== taskId) {
      throw new Error(`Task resume identity mismatch: expected ${taskId}, received ${result?.taskId}`)
    }
    if (!isTaskStatus(result.status)) throw new Error(`Task ${taskId} returned an invalid resume status`)
    return result
  }

  status(taskId: string): Promise<TaskStatusSnapshot> {
    return this.gateway.getTaskStatus(taskId)
  }

  cacheStats(): SharedCacheMetricsSnapshot {
    return this.layeredCache?.aggregateStats() ?? this.cacheMetrics.stats()
  }

  private invalidateLayeredRevisions(projectRevision: number | undefined): void {
    if (!this.layeredCache || projectRevision === undefined) return
    this.layeredCache.invalidate({ reason: 'revision', projectRevision })
  }

  private touchLayeredCaches(task: AiTask, cacheKey: DeterministicTaskCacheKey): AiTask {
    if (!this.layeredCache) return task

    const contextKey = createLayerCacheKey(cacheKey, 'context')
    let contextEntry = this.layeredCache.get('context', contextKey)
    if (contextEntry === undefined) {
      const payload = asRecord(task.input.payload)
      contextEntry = {
        fingerprint: cacheKey.contextFingerprint,
        revision: cacheKey.projectRevision,
        value: payload?.context ?? null,
      }
      this.layeredCache.set('context', contextKey, contextEntry)
    }

    const semanticKey = createLayerCacheKey(cacheKey, 'semantic')
    let semanticEntry = this.layeredCache.get('semantic', semanticKey)
    if (semanticEntry === undefined) {
      semanticEntry = {
        documentId: task.input.documentId,
        revision: task.input.selection?.revision ?? cacheKey.projectRevision,
        text: task.input.text,
        selection: task.input.selection ? { ...task.input.selection } : undefined,
      }
      this.layeredCache.set('semantic', semanticKey, semanticEntry)
    }

    const cachedContext = asRecord(contextEntry)?.value
    const cachedSemantic = asRecord(semanticEntry)
    const payload = asRecord(task.input.payload)
    return {
      ...task,
      input: {
        ...task.input,
        text: typeof cachedSemantic?.text === 'string' ? cachedSemantic.text : task.input.text,
        payload: {
          ...payload,
          ...(cachedContext === undefined ? {} : { context: cachedContext }),
        },
      },
    }
  }

  private readCached(task: AiTask, cacheKey: DeterministicTaskCacheKey): TaskResult | undefined {
    const serializedKey = serializeKey(cacheKey)
    const documentId = task.input.documentId ?? 'unknown-document'
    const hasRevisionVariant =
      hasCachedRevisionVariant(this.cache, serializedKey) ||
      hasCachedRevisionForDocument(this.cachedRevisions, documentId, cacheKey.projectRevision)
    const cached = this.cache.get(cacheKey)
    if (cached === undefined) {
      this.cacheMetrics.record('miss')
      if (hasRevisionVariant) this.cacheMetrics.record('invalidation')
      return undefined
    }
    this.cacheMetrics.record('hit')
    this.cachedRevisions.set(documentId, cacheKey.projectRevision)
    return cached
  }

  private writeCached(task: AiTask, cacheKey: DeterministicTaskCacheKey, result: TaskResult): void {
    const documentId = task.input.documentId ?? 'unknown-document'
    const previousEvictions = this.cache.stats().evictions
    this.cache.set(cacheKey, result)
    const evictions = this.cache.stats().evictions - previousEvictions
    if (evictions > 0) this.cacheMetrics.record('eviction', evictions)
    this.cachedRevisions.set(documentId, cacheKey.projectRevision)
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
    let artifact
    try {
      artifact = await this.artifactRuntime.persistTaskResult(
        task,
        result,
        artifactId,
        persistenceOptions,
      )
    } catch (err) {
      console.warn('[CreativeIntelligence] Persisting artifact failed or storage unconfigured; falling back gracefully:', err)
      return result
    }
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

function isLayeredContextCache(
  value: ContextCache<TaskResult> | LayeredContextCache<TaskResult> | undefined,
): value is LayeredContextCache<TaskResult> {
  return value instanceof LayeredContextCache
}

function hasCachedRevisionVariant(cache: { keys(): string[] }, serializedKey: string): boolean {
  const identity = withoutProjectRevision(serializedKey)
  return cache
    .keys()
    .some((key) => key !== serializedKey && withoutProjectRevision(key) === identity)
}

function hasCachedRevisionForDocument(
  revisions: Map<string, number | undefined>,
  documentId: string,
  projectRevision: number | undefined,
): boolean {
  return revisions.has(documentId) && revisions.get(documentId) !== projectRevision
}

function withoutProjectRevision(serializedKey: string): string {
  return serializedKey.replace(/&projectRevision=[^&]*/, '&projectRevision=')
}

function createLayerCacheKey(
  cacheKey: DeterministicTaskCacheKey,
  layer: 'context' | 'semantic',
): Omit<ContextCacheKey, 'layer'> {
  return {
    taskKind: `creative.${layer}`,
    contextFingerprint: cacheKey.contextFingerprint,
    projectRevision: cacheKey.projectRevision,
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

const TASK_STATUSES: readonly TaskStatus[] = [
  'created',
  'queued',
  'running',
  'checkpointed',
  'waiting-user',
  'interrupted',
  'completed',
  'failed',
  'cancelled',
]

const DEFAULT_INTERACTIVE_TIMEOUT_MS = 2 * 60 * 1000
const DEFAULT_BACKGROUND_TIMEOUT_MS = 15 * 60 * 1000

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
}

function assertTaskSubmitResult(result: TaskSubmitResult, task: AiTask): void {
  if (result?.taskId !== task.id) {
    throw new Error(
      `Task submit identity mismatch: expected ${task.id}, received ${result?.taskId}`,
    )
  }
  if (!isTaskStatus(result.status)) {
    throw new Error(`Task ${task.id} returned an invalid submit status`)
  }
}

function assertTaskStatusSnapshot(snapshot: TaskStatusSnapshot, task: AiTask): void {
  if (snapshot?.taskId !== task.id) {
    throw new Error(
      `Task status identity mismatch: expected ${task.id}, received ${snapshot?.taskId}`,
    )
  }
  if (snapshot.kind !== task.kind) {
    throw new Error(
      `Task status kind mismatch for ${task.id}: expected ${task.kind}, received ${snapshot.kind}`,
    )
  }
  if (!isTaskStatus(snapshot.status)) {
    throw new Error(`Task ${task.id} returned an invalid status snapshot`)
  }
  if (
    snapshot.result &&
    (snapshot.result.taskId !== task.id ||
      snapshot.result.kind !== task.kind ||
      !isTerminal(snapshot.result.status) ||
      snapshot.result.status !== snapshot.status)
  ) {
    throw new Error(`Task result identity mismatch for ${task.id}`)
  }
}

function resolveTaskTimeout(task: AiTask, requestedTimeoutMs?: number): number {
  const configuredTimeout = requestedTimeoutMs ?? task.executionPolicy?.timeoutMs
  if (configuredTimeout !== undefined) {
    if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
      throw new Error('Task timeoutMs must be a finite number greater than zero')
    }
    return configuredTimeout
  }
  const mode = task.executionPolicy?.mode ?? task.executionPolicy?.scheduling
  return mode === 'background' || mode === 'batch'
    ? DEFAULT_BACKGROUND_TIMEOUT_MS
    : DEFAULT_INTERACTIVE_TIMEOUT_MS
}

async function cancelAfterTimeout(gateway: CreativeTaskGateway, taskId: string): Promise<void> {
  try {
    await gateway.cancelTask(taskId)
  } catch {
    // The timeout is still the primary failure; cancellation is best effort.
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError'
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function taskTimeoutError(taskId: string, timeoutMs: number): Error {
  const error = new Error(`Task ${taskId} timed out after ${timeoutMs}ms`)
  error.name = 'TimeoutError'
  return error
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function callWithDeadline<T>(
  operation: () => Promise<T>,
  deadline: number,
  timeoutError: Error,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => finish(reject, abortError())
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const finish = (settle: (value: never) => void, value: Error | T) => {
      if (settled) return
      settled = true
      cleanup()
      settle(value as never)
    }

    if (signal?.aborted) {
      finish(reject, abortError())
      return
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      finish(reject, timeoutError)
      return
    }
    timer = setTimeout(() => finish(reject, timeoutError), remaining)
    signal?.addEventListener('abort', onAbort, { once: true })
    void Promise.resolve()
      .then(() => {
        if (signal?.aborted) throw abortError()
        return operation()
      })
      .then(
        (value) => finish(resolve, value),
        (error: unknown) => finish(reject, error instanceof Error ? error : new Error(String(error))),
      )
  })
}

function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const finish = (settle: (value: never) => void, value: Error | T) => {
      if (settled) return
      settled = true
      cleanup()
      settle(value as never)
    }
    const onAbort = () => finish(reject, abortError())
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void promise.then(
      (value) => finish(resolve, value),
      (error: unknown) => finish(reject, error instanceof Error ? error : new Error(String(error))),
    )
  })
}

function serializeTaskIdentity(task: AiTask): string {
  return stableSerialize(task)
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

function abortError(): Error {
  const error = new Error('Creative task was cancelled')
  error.name = 'AbortError'
  return error
}
