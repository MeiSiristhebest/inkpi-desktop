import { describe, expect, it } from 'vitest'
import { ContextCache, serializeKey } from './index'

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

  it('tracks deterministic cache hits and misses across every cache identity dimension', () => {
    const cache = new ContextCache<string>()
    const key = {
      taskKind: 'creative.continue',
      instruction: 'runtime-v1',
      skill: 'continuity-v2',
      instructionVersion: '1.0.0',
      skillVersion: '2.0.0',
      projectRevision: 7,
      contextFingerprint: 'context-a',
      intentFingerprint: 'intent-a',
      model: 'model-a',
      provider: 'provider-a',
    }

    expect(cache.get(key)).toBeUndefined()
    cache.set(key, 'cached')
    expect(cache.get(key)).toBe('cached')
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1 })

    const changedDimensions = [
      { instruction: 'runtime-v2' },
      { skill: 'continuity-v3' },
      { instructionVersion: '1.0.1' },
      { skillVersion: '2.0.1' },
      { projectRevision: 8 },
      { contextFingerprint: 'context-b' },
      { intentFingerprint: 'intent-b' },
      { model: 'model-b' },
      { provider: 'provider-b' },
    ]
    for (const change of changedDimensions) {
      expect(cache.get({ ...key, ...change })).toBeUndefined()
    }
  })

  it('serializes aliases and fields in a stable order', () => {
    const left = serializeKey({
      taskKind: 'task',
      contextFingerprint: 'ctx',
      instructionVersion: 'i1',
      skillVersion: 's1',
      projectRevision: 3,
      modelId: 'm1',
      providerId: 'p1',
    })
    const right = serializeKey({
      taskKind: 'task',
      contextFingerprint: 'ctx',
      instructionVersion: 'i1',
      skillVersion: 's1',
      projectRevision: 3,
      model: 'm1',
      provider: 'p1',
    })
    expect(left).toBe(right)
  })
})
