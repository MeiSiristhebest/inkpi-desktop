import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/indexedDB'
import {
  codexApplicationService,
  timelineApplicationService,
  promiseApplicationService,
} from './domainApplicationServices'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import { storyStateMaterializer } from './storyStateMaterializer'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { StoryState } from '../domain/story/storyState'

describe('DomainApplicationServices & StoryState Integration', () => {
  const workspaceId = 'proj-domain-app-service-test'

  beforeEach(async () => {
    for (const e of await db.getAll<CodexEntity>('codexEntities')) {
      if (e.projectId === workspaceId) await db.delete('codexEntities', e.id)
    }
    for (const t of await db.getAll<NarrativeThread>('narrativeThreads')) {
      if (t.projectId === workspaceId) await db.delete('narrativeThreads', t.id)
    }
    for (const n of await db.getAll<TimelineNode>('timelineNodes')) {
      if (n.projectId === workspaceId) await db.delete('timelineNodes', n.id)
    }
    for (const p of await db.getAll<PromiseLedgerEntry>('promiseLedger')) {
      if (p.projectId === workspaceId) await db.delete('promiseLedger', p.id)
    }
    await db.delete('settingsKV', `storyState::${workspaceId}`)
  })

  it('codexApplicationService.saveEntity stamps canonical author provenance and materializes story state', async () => {
    await codexApplicationService.saveEntity({
      id: 'ent-1',
      projectId: workspaceId,
      name: '楚行云',
      aliases: ['楚师兄'],
      category: 'character',
      attributes: {},
      relations: [],
      summary: '真传大弟子',
      createdAt: 100,
      updatedAt: 100,
    })

    const entities = await db.getAll<CodexEntity>('codexEntities')
    const saved = entities.find((e) => e.id === 'ent-1')
    expect(saved).toBeDefined()
    expect((saved as any).provenance).toBeDefined()
    expect((saved as any).provenance.sourceType).toBe('author')
    expect((saved as any).provenance.factLevel).toBe('canonical-fact')

    const state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state).toBeDefined()
    expect(state!.entities['ent-1']).toBeDefined()
    expect(state!.entities['ent-1'].name).toBe('楚行云')
    expect(state!.entities['ent-1'].provenance.factLevel).toBe('canonical-fact')
  })

  it('untrusted / legacy entity without provenance materializes with hypothesis factLevel (fail-closed INV-05)', async () => {
    await db.put<CodexEntity>('codexEntities', {
      id: 'ent-untrusted',
      projectId: workspaceId,
      name: '未考证的神秘老人',
      aliases: [],
      category: 'character',
      attributes: {},
      relations: [],
      summary: '路人',
      createdAt: 100,
      updatedAt: 100,
    })

    const state = await storyStateMaterializer.materialize(workspaceId)
    expect(state).toBeDefined()
    expect(state!.entities['ent-untrusted']).toBeDefined()
    expect(state!.entities['ent-untrusted'].provenance.sourceType).toBe('derived')
    expect(state!.entities['ent-untrusted'].provenance.factLevel).toBe('hypothesis')
  })

  it('partition merging preserves un-projected collections (relations, scenes, constraints)', async () => {
    const initialState: StoryState = {
      revision: 1,
      entities: {},
      timelines: {},
      events: {},
      promises: {},
      relations: {
        'rel-1': {
          id: 'rel-1',
          sourceEntityId: 'ent-a',
          targetEntityId: 'ent-b',
          type: 'enemy',
          attributes: {},
          provenance: { sourceType: 'author' as const, factLevel: 'canonical-fact' as const },
        },
      },
      scenes: {},
      constraints: {
        'c-1': {
          id: 'c-1',
          type: 'geographical',
          description: '主角在第三卷前不能踏足中州',
          subjectIds: ['ent-a'],
          severity: 'error',
          provenance: { sourceType: 'author' as const, factLevel: 'canonical-fact' as const },
        },
      },
    }
    await indexedDbStoryStateStore.save(workspaceId, initialState)

    await promiseApplicationService.savePromise({
      id: 'prom-1',
      projectId: workspaceId,
      clueName: '太古龙珠',
      tier: 'sub_plot',
      plantChapter: 5,
      softDeadline: 15,
      dueChapterLimit: 25,
      plantNote: '龙珠藏于寒潭',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: 200,
      updatedAt: 200,
    })

    const updatedState = await indexedDbStoryStateStore.load(workspaceId)
    expect(updatedState).toBeDefined()
    expect(updatedState!.relations['rel-1']).toBeDefined()
    expect(updatedState!.constraints['c-1']).toBeDefined()
    expect(updatedState!.promises['prom-1']).toBeDefined()
    expect(updatedState!.promises['prom-1'].provenance.factLevel).toBe('canonical-fact')
  })

  it('delete operations trigger rematerialization', async () => {
    await codexApplicationService.saveEntity({
      id: 'ent-del',
      projectId: workspaceId,
      name: '要删除的实体',
      aliases: [],
      category: 'item',
      attributes: {},
      relations: [],
      summary: '',
      createdAt: 100,
      updatedAt: 100,
    })

    let state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['ent-del']).toBeDefined()

    await codexApplicationService.deleteEntity('ent-del', workspaceId)
    state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['ent-del']).toBeUndefined()
  })
})
