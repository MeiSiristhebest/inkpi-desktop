import type { DomainChangeSet } from '@inkpi/protocol'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { IndexedDbDomainChangeStore } from './indexedDbDomainChangeStore'

export interface AppendIndexedDbDomainChangeInput {
  aggregateType: string
  aggregateId: string
  workspaceId: string
  operation: 'upsert' | 'delete'
  payload: unknown
  occurredAt: number
  aggregateRevision?: number
}

const domainChangeStore = new IndexedDbDomainChangeStore()
const sourceDeviceId = resolveSourceDeviceId()
let domainAppendQueue: Promise<void> = Promise.resolve()

/** Allocates and appends a local change set with one shared revision queue. */
export async function appendIndexedDbDomainChange(
  input: AppendIndexedDbDomainChangeInput,
): Promise<DomainChangeSet> {
  const operationPromise = domainAppendQueue.then(async () => {
    assertInput(input)
    const aggregateRevision = input.aggregateRevision ?? 0
    const baseRevision = await domainChangeStore.latestRevision(input.workspaceId)
    const changeId = `${input.aggregateType}-change-${input.aggregateId}-${aggregateRevision}-${input.occurredAt}`
    const changeSet = createDomainChangeSet({
      id: `${input.aggregateType}-${input.aggregateId}-${aggregateRevision}-${input.occurredAt}`,
      workspaceId: input.workspaceId,
      sourceDeviceId,
      baseRevision,
      changes: [
        {
          id: changeId,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          operation: input.operation,
          revision: aggregateRevision,
          payload: input.payload,
          occurredAt: input.occurredAt,
        },
      ],
      createdAt: input.occurredAt,
    })
    await domainChangeStore.append(changeSet)
    return changeSet
  })
  domainAppendQueue = operationPromise.then(
    () => undefined,
    () => undefined,
  )
  return operationPromise
}

function assertInput(input: AppendIndexedDbDomainChangeInput): void {
  if (
    !input.aggregateType.trim() ||
    !input.aggregateId.trim() ||
    !input.workspaceId.trim() ||
    !Number.isFinite(input.occurredAt) ||
    (input.aggregateRevision !== undefined &&
      (!Number.isInteger(input.aggregateRevision) || input.aggregateRevision < 0))
  ) {
    throw new Error('IndexedDB domain change input is invalid')
  }
}

function resolveSourceDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'desktop'
  return (
    localStorage.getItem('inkpi-device-id') ||
    (() => {
      const id = `desktop-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('inkpi-device-id', id)
      return id
    })()
  )
}
