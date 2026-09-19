import { describe, it, expect } from 'vitest'
import type {
  Artifact,
  ArtifactListParams,
  AiTask,
  JitContextQuery,
  WorkspacePurgeParams,
  WorkspacePurgeResult,
} from '@inkpi/protocol'
import runtimeLock from '../../runtime.lock.json'

describe('Runtime Compatibility Gate (CI Contract Enforcement)', () => {
  it('pinned commit in runtime.lock.json corresponds to latest verified runtime', () => {
    expect(runtimeLock.pinnedCommit).toBeDefined()
    expect(runtimeLock.pinnedCommit.length).toBe(40)
    // Pinned commit must match verified upstream commit d7c1334 on MeiSiristhebest/inkpi
    expect(runtimeLock.pinnedCommit).toBe('d7c1334f9f4328113df83ddfc7863502436fc2b8')
  })

  it('verifies Artifact protocol contract supports workspace isolation', () => {
    const artifactSample: Artifact = {
      id: 'art-1',
      taskId: 'task-1',
      kind: 'analysis',
      title: 'Analysis',
      format: 'text',
      data: 'content',
      createdAt: '2026-09-19T00:00:00Z',
      workspaceId: 'ws-tenant-1',
    }
    expect(artifactSample.workspaceId).toBe('ws-tenant-1')

    const listParams: ArtifactListParams = {
      workspaceId: 'ws-tenant-1',
    }
    expect(listParams.workspaceId).toBe('ws-tenant-1')
  })

  it('verifies JIT Context Query protocol contract supports keywords', () => {
    const query: JitContextQuery = {
      workspaceId: 'ws-1',
      terms: ['chapter 1'],
      keywords: ['Lin Fan', 'Forbidden Zone'],
    }
    expect(query.keywords).toContain('Lin Fan')
  })

  it('verifies Workspace Purge RPC protocol types are declared', () => {
    const purgeParams: WorkspacePurgeParams = {
      workspaceId: 'ws-to-purge',
    }
    const purgeResult: WorkspacePurgeResult = {
      purged: true,
      workspaceId: 'ws-to-purge',
    }
    expect(purgeParams.workspaceId).toBe(purgeResult.workspaceId)
  })
})
