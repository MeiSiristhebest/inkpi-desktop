export type CacheLayer = 'context' | 'semantic' | 'provider'

export interface ContextCacheKey {
  taskKind: string
  contextFingerprint: string
  modelId?: string
  model?: string
  instructionVersion?: string
  skillVersion?: string
  projectRevision?: number
  providerId?: string
  layer?: CacheLayer
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
  return [
    key.layer || 'context',
    key.taskKind,
    key.contextFingerprint,
    key.projectRevision === undefined ? '' : String(key.projectRevision),
    key.modelId || key.model || '',
    key.instructionVersion || '',
    key.skillVersion || '',
    key.providerId || '',
  ]
    .map((part) => encodeURIComponent(part))
    .join('|')
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
