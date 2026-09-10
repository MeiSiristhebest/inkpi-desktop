import type {
  DomainProjectionSnapshot,
  DomainChangeSet,
  DomainProjectionApplyResult,
} from '@inkpi/protocol'
import type { AuthoritativeDomainChangeStore } from './domainChangeStore'

export interface DomainSyncRemote {
  pushDomainChangeSet(changeSet: DomainChangeSet): Promise<DomainProjectionApplyResult>
  pullDomainChangeSets(workspaceId: string, afterRevision?: number): Promise<DomainChangeSet[]>
  snapshotDomain(workspaceId: string): Promise<DomainProjectionSnapshot>
  restoreDomainSnapshot(snapshot: DomainProjectionSnapshot): Promise<unknown>
}

export interface DomainSyncResult {
  workspaceId: string
  pushed: number
  pulled: number
  revision: number
  recovered: boolean
}

/** Coordinates the authoritative IndexedDB log with the daemon's derived projection. */
export class DomainSyncService {
  private readonly store: AuthoritativeDomainChangeStore
  private readonly remote: DomainSyncRemote
  private readonly maxRecoveryAttempts: number

  constructor(
    store: AuthoritativeDomainChangeStore,
    remote: DomainSyncRemote,
    maxRecoveryAttempts = 3,
  ) {
    this.store = store
    this.remote = remote
    this.maxRecoveryAttempts = Math.max(0, maxRecoveryAttempts)
  }

  async sync(workspaceId: string): Promise<DomainSyncResult> {
    return this.syncAttempt(workspaceId, 0, false)
  }

  private async syncAttempt(
    workspaceId: string,
    recoveryAttempt: number,
    recoveredBeforeAttempt: boolean,
  ): Promise<DomainSyncResult> {
    if (recoveryAttempt > this.maxRecoveryAttempts) {
      throw new Error(
        `Domain sync did not converge after ${this.maxRecoveryAttempts} recovery attempts`,
      )
    }
    let remoteSnapshot = await this.remote.snapshotDomain(workspaceId)
    let localRevision = await this.store.latestRevision(workspaceId)
    let pushed = 0
    let pulled = 0
    let recovered = recoveredBeforeAttempt

    if (remoteSnapshot.revision > localRevision) {
      await this.store.restoreSnapshot(remoteSnapshot)
      localRevision = remoteSnapshot.revision
      recovered = true
    }

    const pending = await this.store.list(workspaceId, remoteSnapshot.revision)
    for (const changeSet of pending) {
      const applied = await this.remote.pushDomainChangeSet(changeSet)
      if (!applied.accepted && applied.reason === 'revision-conflict') {
        remoteSnapshot = await this.remote.snapshotDomain(workspaceId)
        await this.store.restoreSnapshot(remoteSnapshot)
        recovered = true
        return this.syncAttempt(workspaceId, recoveryAttempt + 1, true)
      }
      if (applied.accepted && !applied.duplicate) pushed += 1
    }

    const incoming = await this.remote.pullDomainChangeSets(
      workspaceId,
      await this.store.latestRevision(workspaceId),
    )
    for (const changeSet of incoming) {
      const current = await this.store.latestRevision(workspaceId)
      if (changeSet.revision <= current) {
        const localAtRevision = (await this.store.list(workspaceId, changeSet.revision - 1)).find(
          (candidate) => candidate.revision === changeSet.revision,
        )
        if (
          localAtRevision &&
          localAtRevision.id === changeSet.id &&
          localAtRevision.checksum === changeSet.checksum
        ) {
          // A remote retry may replay a change set already present locally.
          // The authoritative log is idempotent, so acknowledge it without
          // mutating the local projection or forcing snapshot recovery.
          continue
        }
        const snapshot = await this.remote.snapshotDomain(workspaceId)
        await this.store.restoreSnapshot(snapshot)
        recovered = true
        return this.syncAttempt(workspaceId, recoveryAttempt + 1, true)
      }
      if (changeSet.baseRevision !== current || changeSet.revision !== current + 1) {
        const snapshot = await this.remote.snapshotDomain(workspaceId)
        await this.store.restoreSnapshot(snapshot)
        recovered = true
        return this.syncAttempt(workspaceId, recoveryAttempt + 1, true)
      }
      await this.store.append(changeSet)
      pulled += 1
    }
    return {
      workspaceId,
      pushed,
      pulled,
      revision: await this.store.latestRevision(workspaceId),
      recovered,
    }
  }
}
