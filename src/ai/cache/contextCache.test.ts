import { describe, expect, it } from 'vitest'
import {
  CACHE_LAYERS,
  ContextCache,
  LayeredContextCache,
  SharedCacheMetrics,
  createDeterministicTaskCacheKey,
  serializeKey,
} from './index'

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

  it('counts explicit, revision, and clear invalidations', () => {
    const cache = new ContextCache<string>()
    const oldKey = { taskKind: 'creative.continue', contextFingerprint: 'old', projectRevision: 1 }
    const currentKey = {
      taskKind: 'creative.continue',
      contextFingerprint: 'current',
      projectRevision: 2,
    }

    cache.set(oldKey, 'old')
    cache.set(currentKey, 'current')

    expect(cache.invalidateRevision(2)).toBe(1)
    expect(cache.size()).toBe(1)
    expect(cache.get(currentKey)).toBe('current')
    expect(cache.invalidate(currentKey)).toBe(true)
    cache.set(currentKey, 'current-again')

    expect(cache.clear()).toBe(1)
    expect(cache.stats()).toMatchObject({ hits: 1, invalidations: 3 })
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

  it('changes deterministic identity when content or execution context changes', () => {
    const task = {
      id: 'task-1',
      kind: 'creative.continue',
      input: { documentId: 'doc-1', text: '旧内容', payload: { context: { fingerprint: 'ctx-1' } } },
      intent: '继续写作',
      metadata: {
        projectRevision: 3,
        instructionId: 'instruction-1',
        skillId: 'skill-1',
      },
    }
    const route = { id: 'route-1', modelId: 'model-1', providerId: 'provider-1' }
    const base = createDeterministicTaskCacheKey(task, route)

    const changedTasks = [
      { ...task, input: { ...task.input, text: '新内容' } },
      { ...task, metadata: { ...task.metadata, projectRevision: 4 } },
      { ...task, metadata: { ...task.metadata, instructionId: 'instruction-2' } },
      { ...task, metadata: { ...task.metadata, skillId: 'skill-2' } },
    ]
    for (const changed of changedTasks) {
      expect(createDeterministicTaskCacheKey(changed, route)).not.toEqual(base)
    }
    expect(createDeterministicTaskCacheKey(task, { ...route, modelId: 'model-2' })).not.toEqual(base)
    expect(createDeterministicTaskCacheKey(task, { ...route, providerId: 'provider-2' })).not.toEqual(base)
  })

  it('exposes only the newest value when the same key is replaced', async () => {
    const cache = new ContextCache<string>()
    const key = { taskKind: 'creative.continue', contextFingerprint: 'ctx' }

    await Promise.all([
      Promise.resolve().then(() => cache.set(key, 'old')),
      Promise.resolve().then(() => cache.set(key, 'new')),
    ])

    expect(cache.get(key)).toBe('new')
    expect(cache.size()).toBe(1)
  })

  it('reports per-layer and aggregate stats for a shared cross-layer cache', () => {
    const metrics = new SharedCacheMetrics()
    const cache = new LayeredContextCache<string>({ maxEntries: 1, metrics })
    const key = {
      taskKind: 'creative.continue',
      contextFingerprint: 'context-a',
      projectRevision: 1,
    }

    for (const layer of CACHE_LAYERS) {
      expect(cache.get(layer, key)).toBeUndefined()
      cache.set(layer, key, layer)
      expect(cache.get(layer, key)).toBe(layer)
    }
    cache.set('context', { ...key, contextFingerprint: 'context-b' }, 'replacement')

    expect(cache.invalidate({ reason: 'revision', projectRevision: 2 })).toBe(3)
    expect(cache.stats()).toEqual({
      context: { hits: 1, misses: 1, evictions: 1, invalidations: 1 },
      semantic: { hits: 1, misses: 1, evictions: 0, invalidations: 1 },
      provider: { hits: 1, misses: 1, evictions: 0, invalidations: 1 },
    })
    expect(cache.aggregateStats()).toEqual({
      hits: 3,
      misses: 3,
      evictions: 1,
      invalidations: 3,
    })
    expect(metrics.stats()).toEqual(cache.aggregateStats())
  })
})
