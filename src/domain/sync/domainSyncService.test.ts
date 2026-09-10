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
      .filter(
        (changeSet) => changeSet.workspaceId === workspace && changeSet.revision > afterRevision,
      )
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
  return changeSetForWorkspace(id, workspaceId, baseRevision, createdAt)
}

function changeSetForWorkspace(
  id: string,
  targetWorkspaceId: string,
  baseRevision: number,
  createdAt = 1,
): DomainChangeSet {
  return createDomainChangeSet({
    id,
    workspaceId: targetWorkspaceId,
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
  return snapshotForWorkspace(workspaceId, changeSets)
}

function snapshotForWorkspace(
  targetWorkspaceId: string,
  changeSets: DomainChangeSet[],
): DomainProjectionSnapshot {
  return {
    workspaceId: targetWorkspaceId,
    revision: changeSets.at(-1)?.revision ?? 0,
    changeSets,
    createdAt: 1,
  }
}

function remoteWith(
  options: {
    snapshots?: DomainProjectionSnapshot[]
    pulls?: DomainChangeSet[][]
    pushes?: DomainProjectionApplyResult[]
  } = {},
): DomainSyncRemote {
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
  it('rejects a remote snapshot from another workspace before restoring it', async () => {
    const store = new MemoryDomainChangeStore()
    const remote = remoteWith({ snapshots: [snapshotForWorkspace('foreign-workspace', [])] })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).rejects.toThrow(
      /workspace mismatch/i,
    )
    expect(store.restoreCalls).toHaveLength(0)
    expect(remote.pullDomainChangeSets).not.toHaveBeenCalled()
  })

  it('rejects a corrupt remote snapshot without restoring unverified data', async () => {
    const store = new MemoryDomainChangeStore()
    const corrupt = { ...changeSet('corrupt-snapshot', 0), checksum: 'corrupt' }
    const remote = remoteWith({ snapshots: [snapshot([corrupt])] })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).rejects.toThrow(
      /checksum mismatch/i,
    )
    expect(store.restoreCalls).toHaveLength(0)
    expect(remote.pullDomainChangeSets).not.toHaveBeenCalled()
  })

  it('rejects a remote snapshot with a non-contiguous revision cursor', async () => {
    const store = new MemoryDomainChangeStore()
    const second = changeSet('snapshot-gap', 1)
    const remote = remoteWith({ snapshots: [snapshot([second])] })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).rejects.toThrow(
      /not contiguous/i,
    )
    expect(store.restoreCalls).toHaveLength(0)
  })

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
        {
          accepted: false,
          duplicate: false,
          workspaceId,
          revision: 0,
          reason: 'revision-conflict',
        },
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

  it('recovers from an out-of-order batch instead of appending a gap', async () => {
    const store = new MemoryDomainChangeStore()
    const first = changeSet('batch-remote-1', 0)
    const second = changeSet('batch-remote-2', 1)
    const remote = remoteWith({
      snapshots: [snapshot([]), snapshot([first, second])],
      pulls: [[second, first], []],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      pulled: 0,
      revision: 2,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual([
      'batch-remote-1',
      'batch-remote-2',
    ])
  })

  it('recovers from a remote change set for another workspace', async () => {
    const store = new MemoryDomainChangeStore()
    const foreign = changeSetForWorkspace('foreign-change', 'foreign-workspace', 0)
    const canonical = changeSet('canonical-change', 0)
    const remote = remoteWith({
      snapshots: [snapshot([]), snapshot([canonical])],
      pulls: [[foreign], []],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      revision: 1,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual(['canonical-change'])
  })

  it('recovers from a corrupt remote change set before appending it', async () => {
    const store = new MemoryDomainChangeStore()
    const canonical = changeSet('canonical-after-corruption', 0)
    const corrupt = { ...canonical, id: 'corrupt-pull', checksum: 'corrupt' }
    const remote = remoteWith({
      snapshots: [snapshot([]), snapshot([canonical])],
      pulls: [[corrupt], []],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      revision: 1,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual([
      'canonical-after-corruption',
    ])
  })

  it('recovers when a duplicate revision has a different identity or checksum', async () => {
    const store = new MemoryDomainChangeStore()
    const local = changeSet('local-canonical', 0)
    const conflictingDuplicate = changeSet('different-at-revision-one', 0)
    await store.append(local)
    const remote = remoteWith({
      snapshots: [snapshot([]), snapshot([local])],
      pulls: [[conflictingDuplicate], []],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      revision: 1,
      recovered: true,
    })
    expect(store.restoreCalls).toHaveLength(1)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual(['local-canonical'])
  })

  it('rejects a push result that reports another workspace', async () => {
    const store = new MemoryDomainChangeStore()
    const local = changeSet('local-workspace-check', 0)
    await store.append(local)
    const remote = remoteWith({
      pushes: [
        {
          accepted: true,
          duplicate: false,
          workspaceId: 'foreign-workspace',
          revision: 1,
        },
      ],
    })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).rejects.toThrow(
      /invalid result/i,
    )
    expect(store.restoreCalls).toHaveLength(0)
  })

  it('ignores an idempotent duplicate pull without snapshot recovery', async () => {
    const store = new MemoryDomainChangeStore()
    const first = changeSet('remote-1', 0)
    await store.append(first)
    const remote = remoteWith({ snapshots: [snapshot([first])], pulls: [[first]] })

    await expect(new DomainSyncService(store, remote).sync(workspaceId)).resolves.toMatchObject({
      workspaceId,
      pushed: 0,
      pulled: 0,
      revision: 1,
      recovered: false,
    })
    expect(store.restoreCalls).toHaveLength(0)
    expect((await store.list(workspaceId)).map((record) => record.id)).toEqual(['remote-1'])
  })
})

function cloneChangeSet(changeSet: DomainChangeSet): DomainChangeSet {
  return {
    ...changeSet,
    changes: changeSet.changes.map((change) => ({ ...change })),
  }
}
