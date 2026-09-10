import type {
  DomainProjectionSnapshot,
  DomainChangeSet,
  DomainProjectionApplyResult,
} from '@inkpi/protocol'
import { calculateDomainChangeSetChecksum } from '@inkpi/protocol'
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
    let remoteSnapshot = await this.readRemoteSnapshot(workspaceId)
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
    assertContiguousChangeSets(pending, workspaceId, remoteSnapshot.revision, 'local pending')
    for (const changeSet of pending) {
      const applied = await this.remote.pushDomainChangeSet(changeSet)
      assertApplyResult(applied, workspaceId, changeSet)
      if (!applied.accepted && applied.reason === 'revision-conflict') {
        return this.recoverFromRemoteSnapshot(workspaceId, recoveryAttempt)
      }
      if (!applied.accepted) {
        throw new Error(
          `Remote rejected domain change set ${changeSet.id}: ${applied.reason ?? 'unknown reason'}`,
        )
      }
      if (applied.accepted && !applied.duplicate) pushed += 1
    }

    const incoming = await this.remote.pullDomainChangeSets(
      workspaceId,
      await this.store.latestRevision(workspaceId),
    )
    if (!Array.isArray(incoming)) {
      throw new Error('Remote domain pull returned an invalid change-set list')
    }
    for (const changeSet of incoming) {
      try {
        assertValidChangeSet(changeSet, workspaceId, 'remote domain change set')
      } catch {
        return this.recoverFromRemoteSnapshot(workspaceId, recoveryAttempt)
      }
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
        return this.recoverFromRemoteSnapshot(workspaceId, recoveryAttempt)
      }
      if (changeSet.baseRevision !== current || changeSet.revision !== current + 1) {
        return this.recoverFromRemoteSnapshot(workspaceId, recoveryAttempt)
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

  private async readRemoteSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    const snapshot = await this.remote.snapshotDomain(workspaceId)
    assertValidSnapshot(snapshot, workspaceId)
    return snapshot
  }

  private async recoverFromRemoteSnapshot(
    workspaceId: string,
    recoveryAttempt: number,
  ): Promise<DomainSyncResult> {
    const snapshot = await this.readRemoteSnapshot(workspaceId)
    await this.store.restoreSnapshot(snapshot)
    return this.syncAttempt(workspaceId, recoveryAttempt + 1, true)
  }
}

function assertValidSnapshot(
  value: unknown,
  workspaceId: string,
): asserts value is DomainProjectionSnapshot {
  if (!isRecord(value)) throw new Error('Remote domain snapshot is not an object')
  if (value.workspaceId !== workspaceId) {
    throw new Error(
      `Remote domain snapshot workspace mismatch: expected ${workspaceId}, received ${String(value.workspaceId)}`,
    )
  }
  if (
    typeof value.revision !== 'number' ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !Array.isArray(value.changeSets) ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    throw new Error('Remote domain snapshot has invalid revision or change sets')
  }

  const changeSetIds = new Set<string>()
  for (const [index, changeSet] of value.changeSets.entries()) {
    assertValidChangeSet(changeSet, workspaceId, 'remote domain snapshot change set')
    if (changeSetIds.has(changeSet.id)) {
      throw new Error(`Remote domain snapshot repeats change set: ${changeSet.id}`)
    }
    changeSetIds.add(changeSet.id)
    const expectedRevision = index + 1
    if (
      changeSet.revision !== expectedRevision ||
      changeSet.baseRevision !== expectedRevision - 1
    ) {
      throw new Error('Remote domain snapshot revisions are not contiguous')
    }
  }
  if (value.revision !== value.changeSets.length) {
    throw new Error('Remote domain snapshot cursor does not match its changes')
  }
}

function assertContiguousChangeSets(
  changeSets: unknown,
  workspaceId: string,
  afterRevision: number,
  source: string,
): asserts changeSets is DomainChangeSet[] {
  if (!Array.isArray(changeSets)) throw new Error(`${source} returned an invalid change-set list`)
  let expectedRevision = afterRevision + 1
  for (const changeSet of changeSets) {
    assertValidChangeSet(changeSet, workspaceId, source)
    if (
      changeSet.revision !== expectedRevision ||
      changeSet.baseRevision !== expectedRevision - 1
    ) {
      throw new Error(`${source} revisions are not contiguous`)
    }
    expectedRevision += 1
  }
}

function assertValidChangeSet(
  value: unknown,
  workspaceId: string,
  source: string,
): asserts value is DomainChangeSet {
  if (!isRecord(value)) throw new Error(`${source} is not an object`)
  if (
    typeof value.id !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.sourceDeviceId !== 'string' ||
    !value.id.trim() ||
    !value.workspaceId.trim() ||
    !value.sourceDeviceId.trim()
  ) {
    throw new Error(`${source} has invalid identifiers`)
  }
  if (value.workspaceId !== workspaceId) {
    throw new Error(
      `${source} workspace mismatch: expected ${workspaceId}, received ${value.workspaceId}`,
    )
  }
  if (
    typeof value.baseRevision !== 'number' ||
    typeof value.revision !== 'number' ||
    !Number.isInteger(value.baseRevision) ||
    value.baseRevision < 0 ||
    !Number.isInteger(value.revision) ||
    value.revision !== value.baseRevision + 1 ||
    !Array.isArray(value.changes) ||
    typeof value.checksum !== 'string' ||
    !value.checksum ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    throw new Error(`${source} has invalid revision, changes, or timestamp`)
  }
  for (const change of value.changes) {
    if (
      !isRecord(change) ||
      typeof change.id !== 'string' ||
      typeof change.aggregateType !== 'string' ||
      typeof change.aggregateId !== 'string' ||
      !change.id.trim() ||
      !change.aggregateType.trim() ||
      !change.aggregateId.trim() ||
      (change.operation !== 'upsert' && change.operation !== 'delete') ||
      typeof change.revision !== 'number' ||
      !Number.isInteger(change.revision) ||
      change.revision < 0 ||
      typeof change.occurredAt !== 'number' ||
      !Number.isFinite(change.occurredAt)
    ) {
      throw new Error(`${source} contains an invalid domain change`)
    }
  }

  const changeSet = value as unknown as DomainChangeSet
  const { checksum: _checksum, ...unsigned } = changeSet
  if (calculateDomainChangeSetChecksum(unsigned) !== changeSet.checksum) {
    throw new Error(`${source} checksum mismatch: ${changeSet.id}`)
  }
}

function assertApplyResult(
  value: unknown,
  workspaceId: string,
  changeSet: DomainChangeSet,
): asserts value is DomainProjectionApplyResult {
  if (!isRecord(value)) throw new Error(`Remote push returned an invalid result for ${changeSet.id}`)
  if (
    typeof value.accepted !== 'boolean' ||
    typeof value.duplicate !== 'boolean' ||
    value.workspaceId !== workspaceId ||
    typeof value.revision !== 'number' ||
    !Number.isInteger(value.revision) ||
    value.revision < 0
  ) {
    throw new Error(`Remote push returned an invalid result for ${changeSet.id}`)
  }
  if (value.accepted && value.revision !== changeSet.revision) {
    throw new Error(`Remote push revision mismatch for ${changeSet.id}`)
  }
  if (
    !value.accepted &&
    value.reason !== 'revision-conflict' &&
    value.reason !== 'invalid-change-set'
  ) {
    throw new Error(`Remote push returned an unknown rejection for ${changeSet.id}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
