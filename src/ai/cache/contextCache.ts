import type { AiTask } from '@inkpi/protocol'
import {
  SharedCacheMetrics,
  type CacheMetricEvent,
  type SharedCacheMetricsPort,
} from './sharedCacheMetrics'

export type CacheLayer = 'context' | 'semantic' | 'provider'
export const CACHE_LAYERS = ['context', 'semantic', 'provider'] as const

export interface CacheInvalidationEvent {
  reason: 'revision' | 'manual'
  projectRevision?: number
  layers?: readonly CacheLayer[]
}

export interface ContextCacheKey {
  taskKind: string
  contextFingerprint: string
  /** Stable runtime instruction id/version. Dynamic user intent is separate. */
  instruction?: string
  /** Stable skill id/version. */
  skill?: string
  /** Hash of task input that is not represented by the compiled context. */
  intentFingerprint?: string
  modelId?: string
  model?: string
  providerId?: string
  provider?: string
  instructionVersion?: string
  skillVersion?: string
  projectRevision?: number
  layer?: CacheLayer
}

export interface CacheRouteIdentity {
  id?: string
  modelId?: string
  model?: string
  providerId?: string
  provider?: string
  metadata?: Record<string, unknown>
}

export interface TaskCacheKeyDefaults {
  instruction?: string
  instructionVersion?: string
  skill?: string
  skillVersion?: string
  model?: string
  modelId?: string
  provider?: string
  providerId?: string
}

export interface DeterministicTaskCacheKey extends ContextCacheKey {
  instruction: string
  skill: string
  intentFingerprint: string
  model: string
  provider: string
}

export interface ContextCacheEntry<T> {
  key: string
  value: T
  createdAt: number
  lastAccessedAt: number
  expiresAt?: number
  projectRevision?: number
}

export interface ContextCacheOptions {
  maxEntries?: number
  ttlMs?: number
  now?: () => number
  metrics?: SharedCacheMetricsPort
}

export interface ContextCacheStats {
  hits: number
  misses: number
  evictions: number
  invalidations: number
}

export interface LayeredContextCacheStats {
  context: ContextCacheStats
  semantic: ContextCacheStats
  provider: ContextCacheStats
}

export class ContextCache<T> {
  private readonly entries = new Map<string, ContextCacheEntry<T>>()
  private readonly maxEntries: number
  private readonly ttlMs?: number
  private readonly now: () => number
  private hits = 0
  private misses = 0
  private evictions = 0
  private invalidations = 0
  private readonly metrics?: SharedCacheMetricsPort

  constructor(options: ContextCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 128)
    this.ttlMs = options.ttlMs
    this.now = options.now ?? Date.now
    this.metrics = options.metrics
  }

  get(key: ContextCacheKey): T | undefined {
    const cacheKey = serializeKey(key)
    const entry = this.entries.get(cacheKey)
    if (!entry) {
      this.misses += 1
      this.record('miss')
      return undefined
    }
    const now = this.now()
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      this.entries.delete(cacheKey)
      this.misses += 1
      this.record('miss')
      return undefined
    }
    this.hits += 1
    this.record('hit')
    entry.lastAccessedAt = now
    this.entries.delete(cacheKey)
    this.entries.set(cacheKey, entry)
    return entry.value
  }

  set(key: ContextCacheKey, value: T): void {
    const cacheKey = serializeKey(key)
    const now = this.now()
    this.entries.delete(cacheKey)
    this.entries.set(cacheKey, {
      key: cacheKey,
      value,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: this.ttlMs === undefined ? undefined : now + Math.max(0, this.ttlMs),
      projectRevision: key.projectRevision,
    })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
      this.evictions += 1
      this.record('eviction')
    }
  }

  has(key: ContextCacheKey): boolean {
    return this.get(key) !== undefined
  }

  invalidate(key: ContextCacheKey): boolean {
    return this.remove(serializeKey(key))
  }

  invalidateRevision(projectRevision?: number): number {
    let invalidations = 0
    for (const [cacheKey, entry] of this.entries) {
      const stale =
        projectRevision === undefined ||
        !Number.isFinite(projectRevision) ||
        entry.projectRevision === undefined ||
        !Number.isFinite(entry.projectRevision) ||
        entry.projectRevision < projectRevision
      if (stale && this.remove(cacheKey)) invalidations += 1
    }
    return invalidations
  }

  clear(): number {
    const invalidations = this.entries.size
    this.entries.clear()
    this.invalidations += invalidations
    this.record('invalidation', invalidations)
    return invalidations
  }

  size(): number {
    return this.entries.size
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }

  stats(): ContextCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      invalidations: this.invalidations,
    }
  }

  resetStats(): void {
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    this.invalidations = 0
  }

  private remove(cacheKey: string): boolean {
    const removed = this.entries.delete(cacheKey)
    if (!removed) return false
    this.invalidations += 1
    this.record('invalidation')
    return true
  }

  private record(event: CacheMetricEvent, count = 1): void {
    this.metrics?.record(event, count)
  }
}

export function serializeKey(key: ContextCacheKey): string {
  const parts: Array<[string, string]> = [
    ['layer', key.layer || 'context'],
    ['taskKind', key.taskKind],
    ['instruction', key.instruction || ''],
    ['skill', key.skill || ''],
    ['instructionVersion', key.instructionVersion || ''],
    ['skillVersion', key.skillVersion || ''],
    ['projectRevision', key.projectRevision === undefined ? '' : String(key.projectRevision)],
    ['contextFingerprint', key.contextFingerprint],
    ['intentFingerprint', key.intentFingerprint || ''],
    ['model', key.model || key.modelId || ''],
    ['provider', key.provider || key.providerId || ''],
  ]
  return parts.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&')
}

/**
 * Builds the cache identity used by task execution. The task id is deliberately
 * excluded so equivalent requests can share a provider response.
 */
export function createDeterministicTaskCacheKey(
  task: AiTask,
  route?: CacheRouteIdentity,
  defaults: TaskCacheKeyDefaults = {},
): DeterministicTaskCacheKey {
  const metadata = asRecord(task.metadata) ?? {}
  const contextMetadata = asRecord(task.contextPolicy?.metadata) ?? {}
  const payload = asRecord(task.input.payload)
  const context = asRecord(payload?.context) ?? {}
  const routeMetadata = asRecord(route?.metadata) ?? {}

  const instructionVersion = firstString(metadata.instructionVersion, defaults.instructionVersion)
  const skillVersion = firstString(metadata.skillVersion, defaults.skillVersion)
  const instruction = firstString(
    metadata.instructionId,
    instructionVersion,
    metadata.instruction,
    defaults.instruction,
    'runtime-default',
  ) ?? 'runtime-default'
  const skill = firstString(
    metadata.skillId,
    skillVersion,
    metadata.skill,
    defaults.skill,
    'skill-default',
  ) ?? 'skill-default'
  const projectRevision = firstNumber(
    metadata.projectRevision,
    contextMetadata.projectRevision,
    context.projectRevision,
    task.input.selection?.revision,
  )
  const contextFingerprint = firstString(
    metadata.contextFingerprint,
    contextMetadata.contextFingerprint,
    context.fingerprint,
    hash(stableSerialize({ input: task.input, intent: task.intent })),
  ) ?? 'context-unknown'
  const model =
    firstString(route?.modelId, route?.model, metadata.modelId, metadata.model, defaults.model, defaults.modelId, 'model-unknown') ??
    'model-unknown'
  const provider = firstString(
    route?.providerId,
    route?.provider,
    routeMetadata.providerId,
    routeMetadata.provider,
    metadata.providerId,
    metadata.provider,
    defaults.provider,
    defaults.providerId,
    route?.id,
    'provider-unknown',
  ) ?? 'provider-unknown'

  return {
    layer: 'provider',
    taskKind: task.kind,
    instruction,
    skill,
    instructionVersion,
    skillVersion,
    projectRevision,
    contextFingerprint,
    intentFingerprint: hash(stableSerialize({ input: task.input, intent: task.intent })),
    model,
    modelId: model,
    provider,
    providerId: provider,
  }
}

/** Alias for callers that use the shorter cache-key name. */
export const createTaskCacheKey = createDeterministicTaskCacheKey

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

/** Three explicit cache layers: compiled context, semantic projections, and provider responses. */
export class LayeredContextCache<T> {
  readonly context: ContextCache<T>
  readonly semantic: ContextCache<T>
  readonly provider: ContextCache<T>
  readonly metrics: SharedCacheMetricsPort

  constructor(options: ContextCacheOptions = {}) {
    this.metrics = options.metrics ?? new SharedCacheMetrics()
    const cacheOptions = { ...options, metrics: this.metrics }
    this.context = new ContextCache<T>(cacheOptions)
    this.semantic = new ContextCache<T>(cacheOptions)
    this.provider = new ContextCache<T>(cacheOptions)
  }

  get(layer: CacheLayer, key: Omit<ContextCacheKey, 'layer'>): T | undefined {
    return this.forLayer(layer).get({ ...key, layer })
  }

  set(layer: CacheLayer, key: Omit<ContextCacheKey, 'layer'>, value: T): void {
    this.forLayer(layer).set({ ...key, layer }, value)
  }

  invalidate(event: CacheInvalidationEvent): number {
    return selectLayers(event.layers).reduce(
      (count, layer) =>
        count +
        (event.reason === 'revision'
          ? this.forLayer(layer).invalidateRevision(event.projectRevision)
          : this.forLayer(layer).clear()),
      0,
    )
  }

  invalidateKey(layer: CacheLayer, key: Omit<ContextCacheKey, 'layer'>): boolean {
    return this.forLayer(layer).invalidate({ ...key, layer })
  }

  clear(layer?: CacheLayer): number {
    if (layer) return this.forLayer(layer).clear()
    return CACHE_LAYERS.reduce(
      (count, currentLayer) => count + this.forLayer(currentLayer).clear(),
      0,
    )
  }

  stats(layer: CacheLayer): ContextCacheStats
  stats(): LayeredContextCacheStats
  stats(layer?: CacheLayer): ContextCacheStats | LayeredContextCacheStats {
    if (layer) return this.forLayer(layer).stats()
    return {
      context: this.context.stats(),
      semantic: this.semantic.stats(),
      provider: this.provider.stats(),
    }
  }

  aggregateStats(): ContextCacheStats {
    return CACHE_LAYERS.reduce(
      (total, layer) => addStats(total, this.forLayer(layer).stats()),
      emptyStats(),
    )
  }

  private forLayer(layer: CacheLayer): ContextCache<T> {
    if (layer === 'context') return this.context
    if (layer === 'semantic') return this.semantic
    if (layer === 'provider') return this.provider
    throw new Error(`Unknown cache layer: ${layer}`)
  }
}

function selectLayers(layers: readonly CacheLayer[] | undefined): CacheLayer[] {
  return layers && layers.length > 0 ? [...new Set(layers)] : [...CACHE_LAYERS]
}

function emptyStats(): ContextCacheStats {
  return { hits: 0, misses: 0, evictions: 0, invalidations: 0 }
}

function addStats(left: ContextCacheStats, right: ContextCacheStats): ContextCacheStats {
  return {
    hits: left.hits + right.hits,
    misses: left.misses + right.misses,
    evictions: left.evictions + right.evictions,
    invalidations: left.invalidations + right.invalidations,
  }
}
