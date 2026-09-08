import type { AiTask } from '@inkpi/protocol'

export type CacheLayer = 'context' | 'semantic' | 'provider'

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
}

export interface ContextCacheOptions {
  maxEntries?: number
  ttlMs?: number
  now?: () => number
}

export interface ContextCacheStats {
  hits: number
  misses: number
  evictions: number
}

export class ContextCache<T> {
  private readonly entries = new Map<string, ContextCacheEntry<T>>()
  private readonly maxEntries: number
  private readonly ttlMs?: number
  private readonly now: () => number
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(options: ContextCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 128)
    this.ttlMs = options.ttlMs
    this.now = options.now ?? Date.now
  }

  get(key: ContextCacheKey): T | undefined {
    const cacheKey = serializeKey(key)
    const entry = this.entries.get(cacheKey)
    if (!entry) {
      this.misses += 1
      return undefined
    }
    const now = this.now()
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      this.entries.delete(cacheKey)
      this.misses += 1
      return undefined
    }
    this.hits += 1
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
    })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
      this.evictions += 1
    }
  }

  has(key: ContextCacheKey): boolean {
    return this.get(key) !== undefined
  }

  invalidate(key: ContextCacheKey): boolean {
    return this.entries.delete(serializeKey(key))
  }

  clear(): void {
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }

  stats(): ContextCacheStats {
    return { hits: this.hits, misses: this.misses, evictions: this.evictions }
  }

  resetStats(): void {
    this.hits = 0
    this.misses = 0
    this.evictions = 0
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

  constructor(options: ContextCacheOptions = {}) {
    this.context = new ContextCache<T>(options)
    this.semantic = new ContextCache<T>(options)
    this.provider = new ContextCache<T>(options)
  }

  get(layer: CacheLayer, key: Omit<ContextCacheKey, 'layer'>): T | undefined {
    return this.forLayer(layer).get({ ...key, layer })
  }

  set(layer: CacheLayer, key: Omit<ContextCacheKey, 'layer'>, value: T): void {
    this.forLayer(layer).set({ ...key, layer }, value)
  }

  clear(): void {
    this.context.clear()
    this.semantic.clear()
    this.provider.clear()
  }

  stats(layer: CacheLayer): ContextCacheStats {
    return this.forLayer(layer).stats()
  }

  private forLayer(layer: CacheLayer): ContextCache<T> {
    return layer === 'context' ? this.context : layer === 'semantic' ? this.semantic : this.provider
  }
}
