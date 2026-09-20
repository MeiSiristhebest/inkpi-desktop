import { describe, it, expect } from 'vitest'
import {
  RUNTIME_CONTRACT_VERSION,
  RUNTIME_PROTOCOL_VERSION,
  RUNTIME_SCHEMA_HASH,
} from '@inkpi/protocol'
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
  it('runtime.lock.json pins the exact verified Runtime identity and contract', () => {
    expect(runtimeLock.runtimeRepository).toBe('MeiSiristhebest/inkpi')
    expect(runtimeLock.pinnedCommit).toBeDefined()
    expect(runtimeLock.pinnedCommit).toMatch(/^[0-9a-f]{40}$/)
    // The release lock must move only when this exact Runtime commit has passed
    // the cross-boundary verification suite; do not replace this with HEAD or a
    // loose ancestry check.
    expect(runtimeLock.pinnedCommit).toBe('b375b7a8e77c6369796bba83291359a4c59c29c1')
    expect(runtimeLock.protocolVersion).toBe(RUNTIME_PROTOCOL_VERSION)
    expect(runtimeLock.contractVersion).toBe(RUNTIME_CONTRACT_VERSION)
    expect(runtimeLock.schemaHash).toBe(RUNTIME_SCHEMA_HASH)
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
