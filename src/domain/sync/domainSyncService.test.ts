import { describe, expect, it, vi } from 'vitest'
import type {
  DomainChangeSet,
  DomainProjectionApplyResult,
  DomainProjectionSnapshot,
} from '@inkpi/protocol'
import type { AuthoritativeDomainChangeStore } from './domainChangeStore'
import type { DomainSyncRemote } from './domainSyncService'
import { DomainSyncService } from './domainSyncService'
import { createDomainChangeSet } from './domainChangeSet'

const workspaceId = 'sync-service-workspace'

class MemoryDomainChangeStore implements AuthoritativeDomainChangeStore {
  records: DomainChangeSet[] = []
  restoreCalls: DomainProjectionSnapshot[] = []

  async append(changeSet: DomainChangeSet): Promise<void> {
    this.records.push(cloneChangeSet(changeSet))
  }

  async list(workspace: string, afterRevision = 0): Promise<DomainChangeSet[]> {
    return this.records
      .filter((changeSet) => changeSet.workspaceId === workspace && changeSet.revision > afterRevision)
      .sort((left, right) => left.revision - right.revision)
      .map(cloneChangeSet)
  }

  async latestRevision(workspace: string): Promise<number> {
    const records = await this.list(workspace)
    return records.at(-1)?.revision ?? 0
  }

  async snapshot(workspace: string): Promise<DomainProjectionSnapshot> {
    const changeSets = await this.list(workspace)
    return {
      workspaceId: workspace,
      revision: changeSets.at(-1)?.revision ?? 0,
      changeSets,
      createdAt: 1,
    }
  }

  async restore(snapshot: DomainProjectionSnapshot): Promise<void> {
    await this.restoreSnapshot(snapshot)
  }

  async createSnapshot(workspace: string): Promise<DomainProjectionSnapshot> {
    return this.snapshot(workspace)
  }

  async restoreSnapshot(snapshot: DomainProjectionSnapshot): Promise<void> {
    this.restoreCalls.push(snapshot)
    this.records = snapshot.changeSets.map(cloneChangeSet)
  }
}

function changeSet(id: string, baseRevision: number, createdAt = 1): DomainChangeSet {
  return createDomainChangeSet({
    id,
    workspaceId,
    sourceDeviceId: 'desktop-a',
    baseRevision,
    changes: [
      {
        id: `${id}-change`,
        aggregateType: 'document',
        aggregateId: 'chapter-1',
        operation: 'upsert',
        revision: baseRevision + 1,
        payload: { title: id },
        occurredAt: createdAt,
      },
    ],
    createdAt,
  })
}

function snapshot(changeSets: DomainChangeSet[]): DomainProjectionSnapshot {
  return {
    workspaceId,
    revision: changeSets.at(-1)?.revision ?? 0,
    changeSets,
    createdAt: 1,
  }
}

function remoteWith(options: {
  snapshots?: DomainProjectionSnapshot[]
  pulls?: DomainChangeSet[][]
  pushes?: DomainProjectionApplyResult[]
} = {}): DomainSyncRemote {
  const snapshots = options.snapshots ?? [snapshot([])]
  const pulls = options.pulls ?? [[]]
  const pushes = options.pushes ?? []
  let snapshotIndex = 0
  let pullIndex = 0
  let pushIndex = 0
  return {
    snapshotDomain: vi.fn(async () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)]),
    pullDomainChangeSets: vi.fn(async () => pulls[Math.min(pullIndex++, pulls.length - 1)]),
    pushDomainChangeSet: vi.fn(async () => {
      const result = pushes[Math.min(pushIndex++, pushes.length - 1)]
      return result ?? { accepted: true, duplicate: false, workspaceId, revision: 1 }
    }),
    restoreDomainSnapshot: vi.fn(async () => undefined),
  }
}

describe('DomainSyncService recovery', () => {
  it('restores a newer remote snapshot before pulling incremental changes', async () => {
    const store = new MemoryDomainChangeStore()
    const remoteSnapshot = snapshot([changeSet('remote-1', 0), changeSet('remote-2', 1)])
    const remote = remoteWith({ snapshots: [remoteSnapshot], pulls: [[]] })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      workspaceId,
      pushed: 0,
      pulled: 0,
      revision: 2,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual([
      'remote-1',
      'remote-2',
    ])
  })

  it('preserves the recovered flag after retrying a push revision conflict', async () => {
    const store = new MemoryDomainChangeStore()
    const local = changeSet('local-1', 0)
    await store.append(local)
    const remoteSnapshot = snapshot([local])
    const remote = remoteWith({
      snapshots: [snapshot([]), remoteSnapshot],
      pulls: [[], []],
      pushes: [
        { accepted: false, duplicate: false, workspaceId, revision: 0, reason: 'revision-conflict' },
      ],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      workspaceId,
      revision: 1,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect(remote.pushDomainChangeSet).toHaveBeenCalledTimes(1)
  })

  it('recovers from an out-of-order pull and applies the change on the next attempt', async () => {
    const store = new MemoryDomainChangeStore()
    const first = changeSet('remote-1', 0)
    const second = changeSet('remote-2', 1)
    const third = changeSet('remote-3', 2)
    const remote = remoteWith({
      snapshots: [snapshot([]), snapshot([first, second])],
      pulls: [[third], [third]],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      workspaceId,
      pulled: 1,
      revision: 3,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual([
      'remote-1',
      'remote-2',
      'remote-3',
    ])
  })
})

function cloneChangeSet(changeSet: DomainChangeSet): DomainChangeSet {
  return {
    ...changeSet,
    changes: changeSet.changes.map((change) => ({ ...change })),
  }
}
