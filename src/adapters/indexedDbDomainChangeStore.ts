import { type DomainProjectionSnapshot, type DomainChangeSet } from '@inkpi/protocol'
import { db } from '../db/indexedDB'
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
  key: string
  operation: 'upsert' | 'delete'
  value?: unknown
  expected: unknown
}

export class IndexedDbDomainChangeStore implements AuthoritativeDomainChangeStore {
  private appendQueue: Promise<void> = Promise.resolve()

  async append(changeSet: DomainChangeSet): Promise<void> {
    const operation = this.appendQueue.then(async () => {
      assertValidChangeSet(changeSet)
      await db.runTransaction(['domainChangeSets'], (transaction, fail) => {
        const store = transaction.objectStore('domainChangeSets')
        const existingRequest = store.get(changeSet.id)
        const allChangesRequest = store.getAll()
        let existing: DomainChangeSet | undefined
        let allChanges: DomainChangeSet[] | undefined
        let existingLoaded = false
        let allChangesLoaded = false
        let finished = false

        const finish = () => {
          if (finished || !existingLoaded || !allChangesLoaded) return
          finished = true
          try {
            if (existing) {
              assertValidChangeSet(existing)
              if (existing.checksum === changeSet.checksum) return
              throw new Error(`Domain change set id collision: ${changeSet.id}`)
            }
            const workspaceChanges = allChanges!
              .filter((record) => record.workspaceId === changeSet.workspaceId)
              .sort((left, right) => left.revision - right.revision)
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
        allChangesRequest.onerror = () => fail(allChangesRequest.error)
        allChangesRequest.onsuccess = () => {
          allChanges = (allChangesRequest.result as DomainChangeSet[]) ?? []
          allChangesLoaded = true
          finish()
        }
      })
    })
    this.appendQueue = operation.catch(() => undefined)
    return operation
  }

  /** Atomically appends a change set with its authoritative aggregate record. */
  appendWithAggregate(
    changeSet: DomainChangeSet,
    aggregate: IndexedDbAggregateWrite,
  ): Promise<void> {
    const operation = this.appendQueue.then(async () => {
      assertValidChangeSet(changeSet)
      assertAggregateWrite(aggregate)
      await db.runTransaction(['domainChangeSets', aggregate.store], (transaction, fail) => {
        const domainStore = transaction.objectStore('domainChangeSets')
        const aggregateStore = transaction.objectStore(aggregate.store)
        const changeRequest = domainStore.get(changeSet.id)
        const allChangesRequest = domainStore.getAll()
        const aggregateRequest = aggregateStore.get(aggregate.key)
        let existingChange: DomainChangeSet | undefined
        let allChanges: DomainChangeSet[] | undefined
        let currentAggregate: unknown
        let changeLoaded = false
        let allChangesLoaded = false
        let aggregateLoaded = false

        const finish = () => {
          if (!changeLoaded || !allChangesLoaded || !aggregateLoaded) return
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

            const workspaceChanges = allChanges!
              .filter((record) => record.workspaceId === changeSet.workspaceId)
              .sort((left, right) => left.revision - right.revision)
            validateOrderedChangeSets(workspaceChanges, changeSet.workspaceId)
            const currentRevision = workspaceChanges.at(-1)?.revision ?? 0
            if (
              !existingChange &&
              (changeSet.baseRevision !== currentRevision ||
                changeSet.revision !== currentRevision + 1)
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
            if (!existingChange) domainStore.put(cloneChangeSet(changeSet))
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
        allChangesRequest.onerror = () => fail(allChangesRequest.error)
        allChangesRequest.onsuccess = () => {
          allChanges = (allChangesRequest.result as DomainChangeSet[]) ?? []
          allChangesLoaded = true
          finish()
        }
        aggregateRequest.onerror = () => fail(aggregateRequest.error)
        aggregateRequest.onsuccess = () => {
          currentAggregate = aggregateRequest.result
          aggregateLoaded = true
          finish()
        }
      })
    })
    this.appendQueue = operation.catch(() => undefined)
    return operation
  }

  async list(workspaceId: string, afterRevision = 0): Promise<DomainChangeSet[]> {
    if (typeof workspaceId !== 'string' || !workspaceId.trim())
      throw new Error('Domain change workspace id must not be empty')
    if (!Number.isSafeInteger(afterRevision) || afterRevision < 0)
      throw new Error('Invalid domain change cursor')
    const records = await db.getAll<DomainChangeSet>('domainChangeSets')
    const workspaceRecords = records.filter((record) => record.workspaceId === workspaceId)
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
    const operation = this.appendQueue.then(() =>
      db.runTransaction(['domainChangeSets'], (transaction, fail) => {
        const store = transaction.objectStore('domainChangeSets')
        const request = store.getAll()
        request.onerror = () => fail(request.error)
        request.onsuccess = () => {
          try {
            for (const record of (request.result as DomainChangeSet[]).filter(
              (record) => record.workspaceId === snapshot.workspaceId,
            )) {
              store.delete(record.id)
            }
            for (const changeSet of snapshot.changeSets) {
              store.put(cloneChangeSet(changeSet))
            }
          } catch (error) {
            fail(error)
          }
        }
      }),
    )
    this.appendQueue = operation.catch(() => undefined)
    await operation
  }

  createSnapshot(workspaceId: string): Promise<DomainProjectionSnapshot> {
    return this.snapshot(workspaceId)
  }

  restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void> {
    return this.restore(snapshot)
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
