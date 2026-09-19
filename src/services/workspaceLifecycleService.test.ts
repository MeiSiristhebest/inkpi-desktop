import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkspaceLifecycleService } from './workspaceLifecycleService'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { db } from '../db/indexedDB'

describe('WorkspaceLifecycleService', () => {
  let projectRepo: ProjectRepository
  let idGen: IdGenerator
  let clock: Clock
  let idCounter = 1

  const mockProject: ProjectRecord = {
    id: 'orig-proj',
    name: '原版修仙录',
    genre: '仙侠',
    intro: '修仙传记',
    createdAt: 1000,
    updatedAt: 1000,
  }

  const mockVolume: VolumeRecord = {
    id: 'orig-vol-1',
    projectId: 'orig-proj',
    title: '第一卷 筑基篇',
    order: 0,
    createdAt: 1000,
    updatedAt: 1000,
  }

  const mockChapter: ChapterRecord = {
    id: 'orig-ch-1',
    projectId: 'orig-proj',
    volumeId: 'orig-vol-1',
    title: '第一章 拜入宗门',
    content: '<p>云海飘渺，灵峰高耸。</p>',
    order: 0,
    wordCount: 9,
    status: 'draft',
    revision: 1,
    createdAt: 1000,
    updatedAt: 1000,
  }

  beforeEach(() => {
    idCounter = 1
    idGen = {
      generate: (prefix) => `${prefix}_generated_${idCounter++}`,
    }
    clock = { now: () => 5000 }

    const projects = [mockProject]
    const volumes = [mockVolume]
    const chapters = [mockChapter]

    projectRepo = {
      getAllProjects: vi.fn(async () => projects),
      getProject: vi.fn(async (id) => projects.find((p) => p.id === id)),
      saveProject: vi.fn(async (p) => {
        const idx = projects.findIndex((it) => it.id === p.id)
        if (idx >= 0) projects[idx] = p
        else projects.push(p)
      }),
      deleteProject: vi.fn(async (id) => {
        const idx = projects.findIndex((it) => it.id === id)
        if (idx >= 0) projects.splice(idx, 1)
      }),
      getAllVolumes: vi.fn(async () => volumes),
      getVolumesByProject: vi.fn(async (pId) => volumes.filter((v) => v.projectId === pId)),
      saveVolume: vi.fn(async (v) => {
        const idx = volumes.findIndex((it) => it.id === v.id)
        if (idx >= 0) volumes[idx] = v
        else volumes.push(v)
      }),
      deleteVolume: vi.fn(async (id) => {
        const idx = volumes.findIndex((it) => it.id === id)
        if (idx >= 0) volumes.splice(idx, 1)
      }),
      getAllChapters: vi.fn(async () => chapters),
      getChaptersByProject: vi.fn(async (pId) => chapters.filter((c) => c.projectId === pId)),
      saveChapter: vi.fn(async (c) => {
        const idx = chapters.findIndex((it) => it.id === c.id)
        if (idx >= 0) chapters[idx] = c
        else chapters.push(c)
      }),
      deleteChapter: vi.fn(async (id) => {
        const idx = chapters.findIndex((it) => it.id === id)
        if (idx >= 0) chapters.splice(idx, 1)
      }),
    }
  })

  it('exports full workspace backup with valid manifest and metadata (INV-04)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')

    expect(backup).not.toBeNull()
    if (backup) {
      expect(backup.manifest.archiveType).toBe('inkpi-workspace-backup')
      expect(backup.manifest.workspaceId).toBe('orig-proj')
      expect(backup.manifest.core.volumesCount).toBe(1)
      expect(backup.manifest.core.chaptersCount).toBe(1)
      expect(backup.project.id).toBe('orig-proj')
      expect(backup.volumes[0].id).toBe('orig-vol-1')
      expect(backup.chapters[0].id).toBe('orig-ch-1')
    }
  })

  it('imports workspace and completely remaps object graph to avoid collision (INV-03, INV-04)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    // Add mock domain entity (Codex & Promise)
    const backupWithDomain = {
      ...backup!,
      domainData: {
        codexEntities: [
          {
            id: 'entity-1',
            projectId: 'orig-proj',
            name: '林凡',
            category: 'character',
          },
        ],
        promiseLedger: [
          {
            id: 'promise-1',
            projectId: 'orig-proj',
            title: '宗门大比夺魁',
            chapterId: 'orig-ch-1',
          },
        ],
      },
    }

    const putSpy = vi.spyOn(db, 'put').mockResolvedValue('ok' as any)

    const result = await service.importWorkspace(backupWithDomain)
    expect(result.ok).toBe(true)
    expect(result.workspaceId).toMatch(/^proj_generated_/)
    expect(result.workspaceId).not.toBe('orig-proj')

    // Verify volumes & chapters were remapped with new IDs and foreign keys
    expect(projectRepo.saveVolume).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^vol_generated_/),
        projectId: result.workspaceId,
      }),
    )

    expect(projectRepo.saveChapter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^ch_generated_/),
        projectId: result.workspaceId,
        volumeId: expect.stringMatching(/^vol_generated_/),
      }),
    )

    // Verify domain data foreign keys were updated to new workspaceId
    expect(putSpy).toHaveBeenCalledWith(
      'codexEntities',
      expect.objectContaining({
        projectId: result.workspaceId,
        name: '林凡',
      }),
    )

    expect(putSpy).toHaveBeenCalledWith(
      'promiseLedger',
      expect.objectContaining({
        projectId: result.workspaceId,
        chapterId: expect.stringMatching(/^ch_generated_/),
      }),
    )

    putSpy.mockRestore()
  })

  it('purges workspace completely including chapters, volumes, and domain records', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const deleteSpy = vi.spyOn(db, 'delete').mockResolvedValue(undefined as any)
    const getAllSpy = vi
      .spyOn(db, 'getAll')
      .mockResolvedValue([{ id: 'item-1', projectId: 'orig-proj' }] as any)

    await service.purgeWorkspace('orig-proj')

    expect(projectRepo.deleteChapter).toHaveBeenCalledWith('orig-ch-1')
    expect(projectRepo.deleteVolume).toHaveBeenCalledWith('orig-vol-1')
    expect(projectRepo.deleteProject).toHaveBeenCalledWith('orig-proj')
    expect(deleteSpy).toHaveBeenCalled()

    deleteSpy.mockRestore()
    getAllSpy.mockRestore()
  })

  it('fails and rolls back if referential integrity is broken in Pass 3 (P0-1, INV-08)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    // Add broken foreign key referencing non-existent chapter
    const brokenBackup = {
      ...backup!,
      domainData: {
        promiseLedger: [
          {
            id: 'broken-promise',
            projectId: 'orig-proj',
            chapterId: 'non-existent-ch-999',
          },
        ],
      },
    }

    const result = await service.importWorkspace(brokenBackup)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Referential integrity violation')
  })

  it('calls remote purgeWorkspace before local purge when remoteClient is provided (P0-2)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const remoteClient = {
      purgeWorkspace: vi.fn().mockResolvedValue({ purged: true, workspaceId: 'orig-proj' }),
    }

    await service.purgeWorkspace('orig-proj', remoteClient)
    expect(remoteClient.purgeWorkspace).toHaveBeenCalledWith('orig-proj')
    expect(projectRepo.deleteProject).toHaveBeenCalledWith('orig-proj')
  })

  it('deeply remaps entity relations, sourceEntityId, targetEntityId, and array references (P0-1)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    const backupWithGraph = {
      ...backup!,
      domainData: {
        codexEntities: [
          {
            id: 'ent-a',
            projectId: 'orig-proj',
            name: 'Hero',
            relations: [{ targetId: 'ent-b', type: 'ally' }],
          },
          {
            id: 'ent-b',
            projectId: 'orig-proj',
            name: 'Mentor',
          },
        ],
        characterRelations: [
          {
            id: 'rel-1',
            projectId: 'orig-proj',
            sourceEntityId: 'ent-a',
            targetEntityId: 'ent-b',
          },
        ],
        timelineNodes: [
          {
            id: 'node-1',
            projectId: 'orig-proj',
            entityIds: ['ent-a', 'ent-b'],
          },
        ],
      },
    }

    const putSpy = vi.spyOn(db, 'put').mockResolvedValue(undefined as any)
    const result = await service.importWorkspace(backupWithGraph)
    expect(result.ok).toBe(true)

    // Inspect the putSpy calls to verify deep remapped IDs
    const putCalls = putSpy.mock.calls
    const relPut = putCalls.find((call) => call[0] === 'characterRelations')
    expect(relPut).toBeDefined()
    const remappedRel = relPut![1] as any
    expect(remappedRel.sourceEntityId).not.toBe('ent-a')
    expect(remappedRel.sourceEntityId).toContain('-imported-')
    expect(remappedRel.targetEntityId).not.toBe('ent-b')
    expect(remappedRel.targetEntityId).toContain('-imported-')

    const codexPut = putCalls.find((call) => call[0] === 'codexEntities' && (call[1] as any).name === 'Hero')
    expect(codexPut).toBeDefined()
    const heroEntity = codexPut![1] as any
    expect(heroEntity.relations[0].targetId).toBe(remappedRel.targetEntityId)

    const timelinePut = putCalls.find((call) => call[0] === 'timelineNodes')
    expect(timelinePut).toBeDefined()
    const timelineNode = timelinePut![1] as any
    expect(timelineNode.entityIds[0]).toBe(remappedRel.sourceEntityId)
    expect(timelineNode.entityIds[1]).toBe(remappedRel.targetEntityId)

    putSpy.mockRestore()
  })

  it('fails and rolls back if an entity relation references a dangling entity (P0-1 Graph Integrity)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    const brokenGraph = {
      ...backup!,
      domainData: {
        characterRelations: [
          {
            id: 'rel-broken',
            projectId: 'orig-proj',
            sourceEntityId: 'ghost-entity-999',
            targetEntityId: 'ghost-entity-888',
          },
        ],
      },
    }

    const result = await service.importWorkspace(brokenGraph)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Referential integrity violation')
    expect(result.error).toContain('ghost-entity-999')
  })

  it('records durable purge tombstone on offline purge and retries upon processPendingPurgeTombstones', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    // Purge without remote client (simulating offline)
    await service.purgeWorkspace('offline-project-to-purge')

    // Now remote client becomes available
    const remoteClient = {
      purgeWorkspace: vi.fn().mockResolvedValue({ purged: true, workspaceId: 'offline-project-to-purge' }),
    }

    await service.processPendingPurgeTombstones(remoteClient)
    expect(remoteClient.purgeWorkspace).toHaveBeenCalledWith('offline-project-to-purge')

    // Second call should not trigger again since tombstone was cleared
    remoteClient.purgeWorkspace.mockClear()
    await service.processPendingPurgeTombstones(remoteClient)
    expect(remoteClient.purgeWorkspace).not.toHaveBeenCalled()
  })

  it('deeply remaps nested StoryState in settingsKV (entities, relations, events, promises)', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    const backupWithStoryState = {
      ...backup!,
      domainData: {
        codexEntities: [
          { id: 'ent-1', projectId: 'orig-proj', name: 'Lin Fan' },
          { id: 'ent-2', projectId: 'orig-proj', name: 'Elder Wu' },
        ],
        narrativeThreads: [
          { id: 'th-1', projectId: 'orig-proj', name: 'Main Quest' },
        ],
        settingsKV: [
          {
            key: 'storyState::orig-proj',
            value: {
              projectId: 'orig-proj',
              entities: {
                'ent-1': { id: 'ent-1', name: 'Lin Fan' },
                'ent-2': { id: 'ent-2', name: 'Elder Wu' },
              },
              relations: {
                'rel-1': {
                  id: 'rel-1',
                  sourceEntityId: 'ent-1',
                  targetEntityId: 'ent-2',
                  type: 'master-disciple',
                },
              },
              events: {
                'evt-1': {
                  id: 'evt-1',
                  entityIds: ['ent-1', 'ent-2'],
                },
              },
              promises: {
                'prom-1': {
                  id: 'prom-1',
                  threadId: 'th-1',
                },
              },
            },
          },
        ],
      },
    }

    const putSpy = vi.spyOn(db, 'put').mockResolvedValue(undefined as any)
    const result = await service.importWorkspace(backupWithStoryState)
    expect(result.ok).toBe(true)

    const putCalls = putSpy.mock.calls
    const storyStatePut = putCalls.find(
      (call) => call[0] === 'settingsKV' && (call[1] as any).key.startsWith('storyState::'),
    )
    expect(storyStatePut).toBeDefined()
    const remappedState = (storyStatePut![1] as any).value

    // Verify entities keys and IDs were remapped
    const entityKeys = Object.keys(remappedState.entities)
    expect(entityKeys).toHaveLength(2)
    expect(entityKeys[0]).not.toBe('ent-1')
    expect(entityKeys[0]).toContain('-imported-')
    expect(remappedState.entities[entityKeys[0]].id).toBe(entityKeys[0])

    // Verify relations sourceEntityId & targetEntityId match new entity IDs
    const rel = remappedState.relations['rel-1']
    expect(rel.sourceEntityId).toBe(remappedState.entities[entityKeys[0]].id)
    expect(rel.targetEntityId).toBe(remappedState.entities[entityKeys[1]].id)

    // Verify events entityIds match new entity IDs
    const evt = remappedState.events['evt-1']
    expect(evt.entityIds).toEqual(entityKeys)

    // Verify promises threadId was remapped with thread namespace
    const prom = remappedState.promises['prom-1']
    expect(prom.threadId).not.toBe('th-1')
    expect(prom.threadId).toContain('-imported-')

    putSpy.mockRestore()
  })

  it('deeply remaps artifact lineage and fails Pass 3 if lineage.parentArtifactId is dangling', async () => {
    const service = new WorkspaceLifecycleService(projectRepo, idGen, clock)
    const backup = await service.exportWorkspaceBackup('orig-proj')
    expect(backup).not.toBeNull()

    const backupWithArtifacts = {
      ...backup!,
      domainData: {
        aiArtifacts: [
          {
            id: 'art-parent',
            projectId: 'orig-proj',
            ownership: { workspaceId: 'orig-proj' },
          },
          {
            id: 'art-child',
            projectId: 'orig-proj',
            ownership: { workspaceId: 'orig-proj' },
            lineage: { parentArtifactId: 'art-parent' },
          },
        ],
      },
    }

    const putSpy = vi.spyOn(db, 'put').mockResolvedValue(undefined as any)
    const successResult = await service.importWorkspace(backupWithArtifacts)
    expect(successResult.ok).toBe(true)

    const putCalls = putSpy.mock.calls
    const childPut = putCalls.find((call) => call[0] === 'aiArtifacts' && (call[1] as any).id.startsWith('art-child'))
    expect(childPut).toBeDefined()
    const remappedChild = childPut![1] as any
    expect(remappedChild.lineage.parentArtifactId).not.toBe('art-parent')
    expect(remappedChild.lineage.parentArtifactId).toContain('art-parent-imported-')
    putSpy.mockRestore()

    // Test failure when parentArtifactId is dangling
    const danglingBackup = {
      ...backup!,
      domainData: {
        aiArtifacts: [
          {
            id: 'art-child',
            projectId: 'orig-proj',
            ownership: { workspaceId: 'orig-proj' },
            lineage: { parentArtifactId: 'ghost-parent-artifact' },
          },
        ],
      },
    }

    const failResult = await service.importWorkspace(danglingBackup)
    expect(failResult.ok).toBe(false)
    expect(failResult.error).toContain('Referential integrity violation')
    expect(failResult.error).toContain('ghost-parent-artifact')
  })
})
