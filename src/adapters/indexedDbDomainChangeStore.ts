import { type DomainProjectionSnapshot, type DomainChangeSet } from '@inkpi/protocol'
import { db, readIndexInTransaction } from '../db/indexedDB'
import { assertDomainChangeSet, cloneDomainChangeSet } from '../domain/sync/domainChangeSet'
import type { AuthoritativeDomainChangeStore } from '../domain/sync/domainChangeStore'

export type { AuthoritativeDomainChangeStore } from '../domain/sync/domainChangeStore'

export interface IndexedDbAggregateWrite {
  store:
    | 'projects'
    | 'volumes'
    | 'chapters'
    | 'settingsKV'
    | 'codexEntities'
    | 'narrativeThreads'
    | 'timelineNodes'
    | 'promiseLedger'
    | 'formData'
    | 'tableRows'
    | 'cardRecords'
    | 'multiCalendars'
    | 'geoMapGrids'
    | 'factionDiplomacies'
    | 'powerTierSystems'
    | 'sceneBeats'
    | 'expectationContracts'
  key: string
  operation: 'upsert' | 'delete'
  value?: unknown
  expected: unknown
}

let domainAppendQueue: Promise<void> = Promise.resolve()
let domainAllocationQueue: Promise<void> = Promise.resolve()

/** Serializes revision allocation across the project and plugin adapters. */
export function enqueueIndexedDbDomainChange<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = domainAllocationQueue.then(operation)
  domainAllocationQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  )
  return queuedOperation
}

export class IndexedDbDomainChangeStore implements AuthoritativeDomainChangeStore {
  async append(changeSet: DomainChangeSet): Promise<void> {
    const operation = domainAppendQueue.then(async () => {
      assertValidChangeSet(changeSet)
      await db.runTransaction(['domainChangeSets'], (transaction, fail) => {
        const store = transaction.objectStore('domainChangeSets')
        const existingRequest = store.get(changeSet.id)
        let existing: DomainChangeSet | undefined
        let workspaceJournal: DomainChangeSet[] = []
        let existingLoaded = false
        let journalLoaded = false
        let finished = false

        const finish = () => {
          if (finished || !existingLoaded || !journalLoaded) return
          finished = true
          try {
            if (existing) {
              assertValidChangeSet(existing)
              if (existing.checksum === changeSet.checksum) return
              throw new Error(`Domain change set id collision: ${changeSet.id}`)
            }
            const workspaceChanges = workspaceJournal.sort(
              (left, right) => left.revision - right.revision,
            )
            validateOrderedChangeSets(workspaceChanges, changeSet.workspaceId)
            const current = workspaceChanges.at(-1)?.revision ?? 0
            if (changeSet.baseRevision !== current || changeSet.revision !== current + 1) {
              throw new Error(
                `Domain change revision conflict: expected base ${current}, received ${changeSet.baseRevision}`,
              )
            }
            store.put(cloneDomainChangeSet(changeSet))
          } catch (error) {
            fail(error)
          }
        }

        existingRequest.onerror = () => fail(existingRequest.error)
        existingRequest.onsuccess = () => {
          existing = existingRequest.result as DomainChangeSet | undefined
          existingLoaded = true
          finish()
        }
        readIndexInTransaction<DomainChangeSet>(store, 'workspaceId', changeSet.workspaceId, {
          onSuccess: (records) => {
            workspaceJournal = records
            journalLoaded = true
            finish()
          },
          onError: (error) => fail(error),
        })
      })
    })
    domainAppendQueue = operation.catch(() => undefined)
    return operation
  }

  /** Atomically appends a change set with its authoritative aggregate record. */
  appendWithAggregate(
    changeSet: DomainChangeSet,
    aggregate: IndexedDbAggregateWrite,
  ): Promise<void> {
    const operation = domainAppendQueue.then(async () => {
      assertValidChangeSet(changeSet)
      assertAggregateWrite(aggregate)
      await db.runTransaction(['domainChangeSets', aggregate.store], (transaction, fail) => {
        const domainStore = transaction.objectStore('domainChangeSets')
        const aggregateStore = transaction.objectStore(aggregate.store)
        const changeRequest = domainStore.get(changeSet.id)
        const aggregateRequest = aggregateStore.get(aggregate.key)
        let existingChange: DomainChangeSet | undefined
        let workspaceJournal: DomainChangeSet[] = []
        let currentAggregate: unknown
        let changeLoaded = false
        let journalLoaded = false
        let aggregateLoaded = false

        const finish = () => {
          if (!changeLoaded || !journalLoaded || !aggregateLoaded) return
          try {
            if (existingChange) {
              assertValidChangeSet(existingChange)
              if (existingChange.checksum !== changeSet.checksum) {
                throw new Error(`Domain change set id collision: ${changeSet.id}`)
              }
              // The domain log and aggregate were committed atomically. A
              // replay of the same change set is therefore already complete;
              // do not apply its aggregate mutation a second time.
              return
            }

            const workspaceChanges = workspaceJournal.sort(
              (left, right) => left.revision - right.revision,
            )
            validateOrderedChangeSets(workspaceChanges, changeSet.workspaceId)
            const currentRevision = workspaceChanges.at(-1)?.revision ?? 0
            if (
              changeSet.baseRevision !== currentRevision ||
              changeSet.revision !== currentRevision + 1
            ) {
              throw new Error(
                `Domain change revision conflict: expected base ${currentRevision}, received ${changeSet.baseRevision}`,
              )
            }
            if (!valuesEqual(currentAggregate, aggregate.expected)) {
              throw new Error(
                `Aggregate ${aggregate.store}/${aggregate.key} changed during the write`,
              )
            }

            if (aggregate.operation === 'upsert') aggregateStore.put(aggregate.value)
            else aggregateStore.delete(aggregate.key)
            domainStore.put(cloneChangeSet(changeSet))
          } catch (error) {
            fail(error)
          }
        }

        changeRequest.onerror = () => fail(changeRequest.error)
        changeRequest.onsuccess = () => {
          existingChange = changeRequest.result as DomainChangeSet | undefined
          changeLoaded = true
          finish()
        }
        readIndexInTransaction<DomainChangeSet>(domainStore, 'workspaceId', changeSet.workspaceId, {
          onSuccess: (records) => {
            workspaceJournal = records
            journalLoaded = true
            finish()
          },
          onError: (error) => fail(error),
        })
        aggregateRequest.onerror = () => fail(aggregateRequest.error)
        aggregateRequest.onsuccess = () => {
          currentAggregate = aggregateRequest.result
          aggregateLoaded = true
          finish()
        }
      })
    })
    domainAppendQueue = operation.catch(() => undefined)
    return operation
  }

  async list(workspaceId: string, afterRevision = 0): Promise<DomainChangeSet[]> {
    if (typeof workspaceId !== 'string' || !workspaceId.trim())
      throw new Error('Domain change workspace id must not be empty')
    if (!Number.isSafeInteger(afterRevision) || afterRevision < 0)
      throw new Error('Invalid domain change cursor')
    const workspaceRecords = await db.getByIndex<DomainChangeSet>(
      'domainChangeSets',
      'workspaceId',
      workspaceId,
    )
    const ordered = workspaceRecords.sort((left, right) => left.revision - right.revision)
    validateOrderedChangeSets(ordered, workspaceId)
    return ordered.filter((record) => record.revision > afterRevision).map(cloneChangeSet)
  }

  async latestRevision(workspaceId: string): Promise<number> {
    const records = await this.list(workspaceId)
    return records.reduce((latest, record) => Math.max(latest, record.revision), 0)
  }

  async snapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    const changeSets = await this.list(workspaceId)
    return {
      workspaceId,
      revision: changeSets.at(-1)?.revision ?? 0,
      changeSets,
      createdAt: Date.now(),
    }
  }

  async restore(snapshot: DomainProjectionSnapshot): Promise<void> {
    if (typeof snapshot.workspaceId !== 'string' || !snapshot.workspaceId.trim())
      throw new Error('Domain projection snapshot workspace id must not be empty')
    if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0)
      throw new Error('Invalid domain projection revision')
    validateOrderedChangeSets(snapshot.changeSets, snapshot.workspaceId)
    if ((snapshot.changeSets.at(-1)?.revision ?? 0) !== snapshot.revision)
      throw new Error('Domain projection snapshot cursor mismatch')
    const operation = domainAppendQueue.then(() =>
      db.runTransaction(['domainChangeSets'], (transaction, fail) => {
        const store = transaction.objectStore('domainChangeSets')
        readIndexInTransaction<DomainChangeSet>(store, 'workspaceId', snapshot.workspaceId, {
          onError: (error) => fail(error),
          onSuccess: (records) => {
            try {
              for (const record of records) {
                store.delete(record.id)
              }
              for (const changeSet of snapshot.changeSets) {
                store.put(cloneChangeSet(changeSet))
              }
            } catch (error) {
              fail(error)
            }
          },
        })
      }),
    )
    domainAppendQueue = operation.catch(() => undefined)
    await operation
  }

  createSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    return this.snapshot(workspaceId)
  }

  restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void> {
    return this.restore(snapshot)
  }

  /**
   * Drops a workspace's journal rows. Workspace deletion is the one case that must not validate
   * what it is deleting: a row left over from an older import can have a stale checksum, and the
   * generic domain-store loop can no longer reach this authoritative store.
   */
  async purgeWorkspace(workspaceId: string): Promise<void> {
    if (typeof workspaceId !== 'string' || !workspaceId.trim())
      throw new Error('Domain change workspace id must not be empty')
    const operation = domainAppendQueue.then(() =>
      db.runTransaction(['domainChangeSets'], (transaction, fail) => {
        const store = transaction.objectStore('domainChangeSets')
        readIndexInTransaction<DomainChangeSet>(store, 'workspaceId', workspaceId, {
          onError: (error) => fail(error),
          onSuccess: (records) => {
            try {
              for (const record of records) {
                store.delete(record.id)
              }
            } catch (error) {
              fail(error)
            }
          },
        })
      }),
    )
    domainAppendQueue = operation.catch(() => undefined)
    await operation
  }
}

function assertValidChangeSet(changeSet: DomainChangeSet): void {
  assertDomainChangeSet(changeSet)
}

function validateOrderedChangeSets(changeSets: DomainChangeSet[], workspaceId: string): void {
  const changeSetIds = new Set<string>()
  for (const [index, changeSet] of changeSets.entries()) {
    assertValidChangeSet(changeSet)
    if (changeSetIds.has(changeSet.id)) {
      throw new Error(`Domain projection contains duplicate change set id: ${changeSet.id}`)
    }
    changeSetIds.add(changeSet.id)
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
  return cloneDomainChangeSet(changeSet)
}

function assertAggregateWrite(aggregate: IndexedDbAggregateWrite): void {
  const allowedStores = new Set<string>([
    'projects',
    'volumes',
    'chapters',
    'settingsKV',
    'codexEntities',
    'narrativeThreads',
    'timelineNodes',
    'promiseLedger',
    'formData',
    'tableRows',
    'cardRecords',
    'multiCalendars',
    'geoMapGrids',
    'factionDiplomacies',
    'powerTierSystems',
    'sceneBeats',
    'expectationContracts',
  ])
  if (!allowedStores.has(aggregate.store)) {
    throw new Error('IndexedDB aggregate store is invalid')
  }
  if (typeof aggregate.key !== 'string' || !aggregate.key.trim())
    throw new Error('IndexedDB aggregate key must not be empty')
  if (aggregate.operation !== 'upsert' && aggregate.operation !== 'delete') {
    throw new Error('IndexedDB aggregate operation is invalid')
  }
  if (aggregate.operation === 'upsert' && aggregate.value === undefined) {
    throw new Error('IndexedDB aggregate upsert requires a value')
  }
  if (aggregate.store === 'settingsKV' && aggregate.operation === 'upsert') {
    if (!isRecord(aggregate.value) || aggregate.value.key !== aggregate.key) {
      throw new Error('IndexedDB settingsKV aggregate value must use the aggregate key')
    }
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right)
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
