import { describe, it, expect } from 'vitest'
import { ContextCache, serializeKey } from './contextCache'

describe('ContextCache Workspace Isolation (P0.12, INV-03)', () => {
  it('strictly segregates cache entries across different workspaces even with identical task, fingerprint, and input', () => {
    const cache = new ContextCache<string>()

    const keyWorkspaceA = {
      workspaceId: 'workspace-a',
      taskKind: 'rewrite',
      contextFingerprint: 'same-fingerprint-hash',
      intentFingerprint: 'same-intent-hash',
      model: 'model-claude',
      provider: 'provider-anthropic',
    }

    const keyWorkspaceB = {
      workspaceId: 'workspace-b',
      taskKind: 'rewrite',
      contextFingerprint: 'same-fingerprint-hash',
      intentFingerprint: 'same-intent-hash',
      model: 'model-claude',
      provider: 'provider-anthropic',
    }

    cache.set(keyWorkspaceA, 'A 的专用产出内容')

    expect(cache.get(keyWorkspaceA)).toBe('A 的专用产出内容')
    expect(cache.get(keyWorkspaceB)).toBeUndefined()

    cache.set(keyWorkspaceB, 'B 的专用产出内容')

    expect(cache.get(keyWorkspaceA)).toBe('A 的专用产出内容')
    expect(cache.get(keyWorkspaceB)).toBe('B 的专用产出内容')

    expect(serializeKey(keyWorkspaceA)).not.toEqual(serializeKey(keyWorkspaceB))
  })
})
