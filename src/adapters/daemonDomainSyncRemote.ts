import type {
  DomainChangeSet,
  DomainProjectionApplyResult,
  DomainProjectionSnapshot,
} from '@inkpi/protocol'
import type { DomainSyncRemote } from '../domain/sync/domainSyncService'
import type { RpcClient } from '../ports/aiGateway'

/** JSON-RPC adapter for the daemon's derived domain projection. */
export function createDaemonDomainSyncRemote(client: RpcClient): DomainSyncRemote {
  return {
    pushDomainChangeSet: (changeSet: DomainChangeSet) =>
      client.request<DomainProjectionApplyResult>('domain.sync.push', { changeSet }),
    pullDomainChangeSets: (workspaceId: string, afterRevision = 0) =>
      client.request<DomainChangeSet[]>('domain.sync.pull', { workspaceId, afterRevision }),
    snapshotDomain: (workspaceId: string) =>
      client.request<DomainProjectionSnapshot>('domain.sync.snapshot', { workspaceId }),
    restoreDomainSnapshot: (snapshot: DomainProjectionSnapshot) =>
      client.request('domain.sync.restore', { snapshot }),
  }
}
