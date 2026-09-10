import { describe, expect, it, vi } from 'vitest'
import type { DomainChangeSet } from '@inkpi/protocol'
import { createDaemonDomainSyncRemote } from './daemonDomainSyncRemote'
import type { RpcClient } from '../ports/aiGateway'

const changeSet: DomainChangeSet = {
  id: 'set-1',
  workspaceId: 'project-1',
  sourceDeviceId: 'desktop-1',
  baseRevision: 0,
  revision: 1,
  changes: [],
  checksum: 'checksum',
  createdAt: 1,
}

describe('daemon domain sync adapter', () => {
  it('maps the four projection operations to the daemon RPC contract', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'domain.sync.push') return { accepted: true, duplicate: false, workspaceId: 'project-1', revision: 1 }
      if (method === 'domain.sync.pull') return [changeSet]
      if (method === 'domain.sync.snapshot') return { workspaceId: 'project-1', revision: 1, changeSets: [changeSet], createdAt: 1 }
      return { workspaceId: 'project-1', revision: 1, updatedAt: 1 }
    })
    const remote = createDaemonDomainSyncRemote({ request, close: vi.fn() } as unknown as RpcClient)

    await expect(remote.pushDomainChangeSet(changeSet)).resolves.toMatchObject({ accepted: true })
    await expect(remote.pullDomainChangeSets('project-1', 0)).resolves.toEqual([changeSet])
    await expect(remote.snapshotDomain('project-1')).resolves.toMatchObject({ revision: 1 })
    await expect(remote.restoreDomainSnapshot({ workspaceId: 'project-1', revision: 1, changeSets: [changeSet], createdAt: 1 })).resolves.toMatchObject({ revision: 1 })

    expect(request.mock.calls).toEqual([
      ['domain.sync.push', { changeSet }],
      ['domain.sync.pull', { workspaceId: 'project-1', afterRevision: 0 }],
      ['domain.sync.snapshot', { workspaceId: 'project-1' }],
      ['domain.sync.restore', { snapshot: { workspaceId: 'project-1', revision: 1, changeSets: [changeSet], createdAt: 1 } }],
    ])
  })
})
