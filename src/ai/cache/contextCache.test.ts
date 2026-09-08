import { describe, expect, it } from 'vitest'
import { ContextCache } from './index'

describe('context fingerprint cache', () => {
  it('keys entries by task, context, model, and instruction version with LRU eviction', () => {
    let now = 100
    const cache = new ContextCache<string>({ maxEntries: 2, ttlMs: 20, now: () => now })
    const first = { taskKind: 'creative.continue', contextFingerprint: 'a', modelId: 'm1' }
    const second = { taskKind: 'creative.continue', contextFingerprint: 'b', modelId: 'm1' }
    const third = { taskKind: 'creative.continue', contextFingerprint: 'c', modelId: 'm1' }
    cache.set(first, 'one')
    cache.set(second, 'two')
    expect(cache.get(first)).toBe('one')
    cache.set(third, 'three')
    expect(cache.get(second)).toBeUndefined()
    expect(cache.get(first)).toBe('one')
    now = 121
    expect(cache.get(first)).toBeUndefined()
  })
})
