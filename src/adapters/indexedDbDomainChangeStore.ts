import { calculateDomainChangeSetChecksum, type DomainProjectionSnapshot, type DomainChangeSet } from '@inkpi/protocol'
import { db } from '../db/indexedDB'

export interface AuthoritativeDomainChangeStore {
  append(changeSet: DomainChangeSet): Promise<void>
  list(workspaceId: string, afterRevision?: number): Promise<DomainChangeSet[]>
  latestRevision(workspaceId: string): Promise<number>
  snapshot(workspaceId: string): Promise<DomainProjectionSnapshot>
  restore(snapshot: DomainProjectionSnapshot): Promise<void>
  createSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot>
  restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void>
}

export class IndexedDbDomainChangeStore implements AuthoritativeDomainChangeStore {
  private appendQueue: Promise<void> = Promise.resolve()

  async append(changeSet: DomainChangeSet): Promise<void> {
    const operation = this.appendQueue.then(async () => {
      assertValidChangeSet(changeSet)
      const existing = await db.get<DomainChangeSet>('domainChangeSets', changeSet.id)
      if (existing) {
        assertValidChangeSet(existing)
        if (existing.checksum === changeSet.checksum) return
        throw new Error(`Domain change set id collision: ${changeSet.id}`)
      }
      const current = await this.latestRevision(changeSet.workspaceId)
      if (changeSet.baseRevision !== current || changeSet.revision !== current + 1) {
        throw new Error(
          `Domain change revision conflict: expected base ${current}, received ${changeSet.baseRevision}`,
        )
      }
      await db.put('domainChangeSets', { ...changeSet, changes: changeSet.changes.map((change) => ({ ...change })) })
    })
    this.appendQueue = operation.catch(() => undefined)
    return operation
  }

  async list(workspaceId: string, afterRevision = 0): Promise<DomainChangeSet[]> {
    if (!workspaceId.trim()) throw new Error('Domain change workspace id must not be empty')
    if (!Number.isInteger(afterRevision) || afterRevision < 0) throw new Error('Invalid domain change cursor')
    const records = await db.getAll<DomainChangeSet>('domainChangeSets')
    const workspaceRecords = records.filter((record) => record.workspaceId === workspaceId)
    const ordered = workspaceRecords.sort((left, right) => left.revision - right.revision)
    validateOrderedChangeSets(ordered, workspaceId)
    return ordered
      .filter((record) => record.revision > afterRevision)
      .map(cloneChangeSet)
  }

  async latestRevision(workspaceId: string): Promise<number> {
    const records = await this.list(workspaceId)
    return records.reduce((latest, record) => Math.max(latest, record.revision), 0)
  }

  async snapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    const changeSets = await this.list(workspaceId)
    return { workspaceId, revision: changeSets.at(-1)?.revision ?? 0, changeSets, createdAt: Date.now() }
  }

  async restore(snapshot: DomainProjectionSnapshot): Promise<void> {
    if (!snapshot.workspaceId.trim()) throw new Error('Domain projection snapshot workspace id must not be empty')
    if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('Invalid domain projection revision')
    validateOrderedChangeSets(snapshot.changeSets, snapshot.workspaceId)
    if ((snapshot.changeSets.at(-1)?.revision ?? 0) !== snapshot.revision) throw new Error('Domain projection snapshot cursor mismatch')
    const existing = await db.getAll<DomainChangeSet>('domainChangeSets')
    for (const record of existing.filter((record) => record.workspaceId === snapshot.workspaceId)) {
      await db.delete('domainChangeSets', record.id)
    }
    for (const changeSet of snapshot.changeSets) await db.put('domainChangeSets', cloneChangeSet(changeSet))
  }

  createSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    return this.snapshot(workspaceId)
  }

  restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void> {
    return this.restore(snapshot)
  }
}

function assertValidChangeSet(changeSet: DomainChangeSet): void {
  if (!changeSet.id.trim() || !changeSet.workspaceId.trim() || !changeSet.sourceDeviceId.trim()) {
    throw new Error('Domain change set identifiers must not be empty')
  }
  if (
    !Number.isInteger(changeSet.baseRevision) ||
    changeSet.baseRevision < 0 ||
    !Number.isInteger(changeSet.revision) ||
    changeSet.revision !== changeSet.baseRevision + 1
  ) {
    throw new Error('Domain change set revisions are invalid')
  }
  const { checksum: _checksum, ...unsigned } = changeSet
  if (calculateDomainChangeSetChecksum(unsigned) !== changeSet.checksum) {
    throw new Error(`Corrupt domain change set checksum: ${changeSet.id}`)
  }
}

function validateOrderedChangeSets(changeSets: DomainChangeSet[], workspaceId: string): void {
  for (const [index, changeSet] of changeSets.entries()) {
    assertValidChangeSet(changeSet)
    if (
      changeSet.workspaceId !== workspaceId ||
      changeSet.revision !== index + 1 ||
      changeSet.baseRevision !== index
    ) {
      throw new Error('Domain projection revisions are not contiguous')
    }
  }
}

function cloneChangeSet(changeSet: DomainChangeSet): DomainChangeSet {
  return {
    ...changeSet,
    changes: changeSet.changes.map((change) => ({ ...change })),
  }
}
