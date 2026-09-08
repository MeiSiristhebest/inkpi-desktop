import type { DomainProjectionSnapshot, DomainChangeSet } from '@inkpi/protocol'

/** Port for the authoritative domain-change log used by the sync use case. */
export interface AuthoritativeDomainChangeStore {
  append(changeSet: DomainChangeSet): Promise<void>
  list(workspaceId: string, afterRevision?: number): Promise<DomainChangeSet[]>
  latestRevision(workspaceId: string): Promise<number>
  snapshot(workspaceId: string): Promise<DomainProjectionSnapshot>
  restore(snapshot: DomainProjectionSnapshot): Promise<void>
  createSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot>
  restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void>
}
