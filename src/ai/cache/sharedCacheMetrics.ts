export type CacheMetricEvent = 'hit' | 'miss' | 'eviction' | 'invalidation'

export interface SharedCacheMetricsSnapshot {
  hits: number
  misses: number
  evictions: number
  invalidations: number
}

/**
 * Shared event-counting port for cache adapters. It carries counters only;
 * cache keys, prompts, results, and private reasoning are never retained.
 */
export interface SharedCacheMetricsPort {
  record(event: CacheMetricEvent, count?: number): void
  stats(): SharedCacheMetricsSnapshot
}

export class SharedCacheMetrics implements SharedCacheMetricsPort {
  private readonly counters: SharedCacheMetricsSnapshot = emptySnapshot()

  record(event: CacheMetricEvent, count = 1): void {
    const increment = Math.floor(count)
    if (!Number.isFinite(increment) || increment <= 0) return

    switch (event) {
      case 'hit':
        this.counters.hits += increment
        break
      case 'miss':
        this.counters.misses += increment
        break
      case 'eviction':
        this.counters.evictions += increment
        break
      case 'invalidation':
        this.counters.invalidations += increment
        break
    }
  }

  stats(): SharedCacheMetricsSnapshot {
    return { ...this.counters }
  }

  snapshot(): SharedCacheMetricsSnapshot {
    return this.stats()
  }

  reset(): void {
    this.counters.hits = 0
    this.counters.misses = 0
    this.counters.evictions = 0
    this.counters.invalidations = 0
  }
}

export function createSharedCacheMetrics(): SharedCacheMetrics {
  return new SharedCacheMetrics()
}

function emptySnapshot(): SharedCacheMetricsSnapshot {
  return { hits: 0, misses: 0, evictions: 0, invalidations: 0 }
}
