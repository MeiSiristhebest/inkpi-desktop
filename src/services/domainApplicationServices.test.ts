import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/indexedDB'
import {
  codexApplicationService,
  promiseApplicationService,
  legacyDomainApplicationService,
} from './domainApplicationServices'
import { domainChangeEvents } from '../ports/domainChangeEvents'
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
    for (const r of await db.getAll('formData')) {
      if (r.projectId === workspaceId) await db.delete('formData', r.id)
    }
    for (const r of await db.getAll('tableRows')) {
      if (r.projectId === workspaceId) await db.delete('tableRows', r.id)
    }
    for (const r of await db.getAll('cardRecords')) {
      if (r.projectId === workspaceId) await db.delete('cardRecords', r.id)
    }
    await db.delete('settingsKV', `storyState::${workspaceId}`)
  })

  it('legacyDomainApplicationService routes Form writes through DomainChangeSet and bumps the workspace revision', async () => {
    const events: number[] = []
    const off = domainChangeEvents.subscribe(workspaceId, (event) => {
      if (event?.revision !== undefined) events.push(event.revision)
    })
    try {
      await legacyDomainApplicationService.saveForm(workspaceId, 'worldview-form', {
        力量体系: '练气、筑基、金丹',
      })
      await legacyDomainApplicationService.saveForm(workspaceId, 'worldview-form', {
        力量体系: '练气、筑基、金丹、元婴',
      })
      await legacyDomainApplicationService.saveTableRow({
        id: 'row-1',
        projectId: workspaceId,
        tabId: 't1',
        order: 0,
        data: { 名称: '玄剑宗' },
        createdAt: 0,
        updatedAt: 0,
      })
      await legacyDomainApplicationService.saveCard({
        id: 'card-1',
        projectId: workspaceId,
        tabId: 'c1',
        name: '楚云',
        order: 0,
        data: {},
        createdAt: 0,
        updatedAt: 0,
      })
    } finally {
      off()
    }

    // 每次写入都应发布单调递增的 workspace revision，驱动 materializeIfStale 实时刷新。
    expect(events.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < events.length; i++) {
      expect(events[i]).toBeGreaterThan(events[i - 1])
    }

    // 持久化断言：Form/Table/Card 记录真实落库。
    const form = await db.get('formData', `${workspaceId}::worldview-form`)
    expect(form).toBeDefined()
    expect((form as any).data['力量体系']).toBe('练气、筑基、金丹、元婴')
    const row = await db.get('tableRows', 'row-1')
    expect((row as any).data['名称']).toBe('玄剑宗')
    const card = await db.get('cardRecords', 'card-1')
    expect((card as any).name).toBe('楚云')

    // StoryState 重物化后，这些 legacy 记录应投影为 story-state 实体。
    const state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state).toBeDefined()
    const entitiesById = Object.fromEntries(
      Object.entries(state!.entities).map(([key, value]) => [key, value as any]),
    )
    // Card 顶层 name 投影为实体名。
    expect(entitiesById['legacy:cardRecords:card-1']?.name).toBe('楚云')
    // TableRow 的原始列宽数据保留在 attributes.data（本例为中文列名 '名称'）。
    const rowEntity = entitiesById['legacy:tableRows:row-1']
    expect(rowEntity).toBeDefined()
    expect(rowEntity.attributes?.data?.['名称']).toBe('玄剑宗')
  })

  it('legacyDomainApplicationService delete ops publish another revision and remove the record', async () => {
    await legacyDomainApplicationService.saveTableRow({
      id: 'del-row',
      projectId: workspaceId,
      tabId: 'del-tab',
      order: 0,
      data: { 名称: '待删行' },
      createdAt: 0,
      updatedAt: 0,
    })
    const before = await db.get('tableRows', 'del-row')
    expect(before).toBeDefined()
    let state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['legacy:tableRows:del-row']).toBeDefined()

    await legacyDomainApplicationService.deleteTableRow('del-row', workspaceId)
    const after = await db.get('tableRows', 'del-row')
    expect(after).toBeUndefined()
    state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['legacy:tableRows:del-row']).toBeUndefined()
  })

  it('codexApplicationService.saveEntity stamps canonical author provenance and materializes story state', async () => {
    await codexApplicationService.saveEntity(
      {
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
      },
      'author-confirmed',
    )

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

  it('codexApplicationService.saveEntity with demo intent assigns hypothesis provenance and prevents canonical-fact', async () => {
    await codexApplicationService.saveEntity(
      {
        id: 'ent-demo',
        projectId: workspaceId,
        name: '示范灵草',
        aliases: [],
        category: 'item',
        attributes: {},
        relations: [],
        summary: 'Demo seed',
        createdAt: 100,
        updatedAt: 100,
      },
      'demo',
    )

    const entities = await db.getAll<CodexEntity>('codexEntities')
    const saved = entities.find((e) => e.id === 'ent-demo')
    expect(saved).toBeDefined()
    expect((saved as any).provenance.sourceType).toBe('derived')
    expect((saved as any).provenance.factLevel).toBe('hypothesis')

    // Domain change sets must be appended with aggregate write
    const domainChanges = await db.getAll<any>('domainChangeSets')
    const entityChange = domainChanges.find(
      (c) => c.workspaceId === workspaceId && c.changes?.[0]?.aggregateId === 'ent-demo',
    )
    expect(entityChange).toBeDefined()
    expect(entityChange.changes[0].operation).toBe('upsert')
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

    await promiseApplicationService.savePromise(
      {
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
      },
      'author-confirmed',
    )

    const updatedState = await indexedDbStoryStateStore.load(workspaceId)
    expect(updatedState).toBeDefined()
    expect(updatedState!.relations['rel-1']).toBeDefined()
    expect(updatedState!.constraints['c-1']).toBeDefined()
    expect(updatedState!.promises['prom-1']).toBeDefined()
    expect(updatedState!.promises['prom-1'].provenance.factLevel).toBe('canonical-fact')
  })

  it('delete operations trigger rematerialization', async () => {
    await codexApplicationService.saveEntity(
      {
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
      },
      'author-confirmed',
    )

    let state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['ent-del']).toBeDefined()

    await codexApplicationService.deleteEntity('ent-del', workspaceId)
    state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['ent-del']).toBeUndefined()
  })

  it('ai-accepted intent upgrades ai-proposed entity to canonical-fact while retaining evidence', async () => {
    // 假设先前存在一个由 AI 提议的实体，具有 evidence
    const proposedEntity: CodexEntity = {
      id: 'ent-ai-proposed',
      projectId: workspaceId,
      name: 'AI 提议的法宝',
      aliases: [],
      category: 'item',
      attributes: {},
      relations: [],
      summary: '从第3章提取',
      createdAt: 100,
      updatedAt: 100,
      provenance: {
        sourceType: 'ai-proposed',
        factLevel: 'proposal',
        createdAt: 100,
        evidence: [
          {
            documentId: 'doc-1',
            blockId: 'blk-1',
            excerpt: '他在寒潭边捡起了一枚古朴的铜镜',
          },
        ],
      } as any,
    }

    // 用户在 UI 点击接受 proposal，以 'ai-accepted' 意图保存
    await codexApplicationService.saveEntity(proposedEntity, 'ai-accepted')

    const entities = await db.getAll<CodexEntity>('codexEntities')
    const saved = entities.find((e) => e.id === 'ent-ai-proposed')
    expect(saved).toBeDefined()
    const prov = (saved as any).provenance
    expect(prov).toBeDefined()
    expect(prov.sourceType).toBe('ai-extracted')
    expect(prov.factLevel).toBe('canonical-fact')
    expect(prov.evidence).toHaveLength(1)
    expect(prov.evidence[0].excerpt).toBe('他在寒潭边捡起了一枚古朴的铜镜')

    const state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state!.entities['ent-ai-proposed'].provenance.factLevel).toBe('canonical-fact')
    expect(state!.entities['ent-ai-proposed'].provenance.sourceType).toBe('ai-extracted')
  })

  it('throws fail-closed error if workspaceId/projectId is empty or missing', async () => {
    const invalidEntity: any = {
      id: 'ent-invalid',
      projectId: '   ',
      name: '无工作区实体',
      aliases: [],
      category: 'item',
      attributes: {},
      relations: [],
      summary: '',
      createdAt: 100,
      updatedAt: 100,
    }

    await expect(
      codexApplicationService.saveEntity(invalidEntity, 'author-confirmed'),
    ).rejects.toThrow('Missing required workspaceId')
  })
})
