import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/indexedDB'
import { storyStateMaterializer } from './storyStateMaterializer'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { MultiCalendarProjectRecord } from '../ports/multiCalendarRepository'
import type { GeoMapGridRecord } from '../ports/geoMapRepository'
import type { FactionDiplomacyRecord } from '../ports/factionDiplomacyRepository'
import type { PowerTierSystem } from '../ports/powerTierRepository'
import type { ChapterBeatPlan } from '../plugins/scene-beats/types'
import type { ExpectationContract } from '../ports/expectationRepository'

describe('StoryStateMaterializer — 生产级领域物化流水线', () => {
  const workspaceId = 'proj-materializer-test'

  beforeEach(async () => {
    // 清理测试用的 workspace 数据
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
    for (const record of await db.getAll<MultiCalendarProjectRecord>('multiCalendars')) {
      if (record.projectId === workspaceId) await db.delete('multiCalendars', record.id)
    }
    for (const record of await db.getAll<GeoMapGridRecord>('geoMapGrids')) {
      if (record.projectId === workspaceId) await db.delete('geoMapGrids', record.id)
    }
    for (const record of await db.getAll<FactionDiplomacyRecord>('factionDiplomacies')) {
      if (record.projectId === workspaceId) await db.delete('factionDiplomacies', record.id)
    }
    for (const record of await db.getAll<PowerTierSystem>('powerTierSystems')) {
      if (record.projectId === workspaceId) await db.delete('powerTierSystems', record.projectId)
    }
    for (const record of await db.getAll<ChapterBeatPlan>('sceneBeats')) {
      if (record.projectId === workspaceId) await db.delete('sceneBeats', record.id)
    }
    for (const record of await db.getAll<ExpectationContract>('expectationContracts')) {
      if (record.projectId === workspaceId) await db.delete('expectationContracts', record.id)
    }
    await db.delete('settingsKV', `storyState::${workspaceId}`)
  })

  it('materializes entities, timelines, events, and promises into canonical StoryState', async () => {
    // 1. 写入 Living Codex 实体
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:lin-fan',
      projectId: workspaceId,
      name: '林凡',
      aliases: ['凡哥', '少宗主'],
      category: 'character',
      attributes: { realm: '筑基初期' },
      relations: [],
      summary: '主角',
      createdAt: 1000,
      updatedAt: 1000,
    })

    // 2. 写入 Timeline 主线与节点
    await db.put<NarrativeThread>('narrativeThreads', {
      id: 'timeline:main',
      projectId: workspaceId,
      name: '宗门崛起主线',
      color: '#ff4400',
      characterIds: ['entity:lin-fan'],
      order: 1,
    })

    await db.put<TimelineNode>('timelineNodes', {
      id: 'event:awakening',
      projectId: workspaceId,
      threadId: 'timeline:main',
      chapterOrder: 1,
      eventTitle: '觉醒仪式',
      summary: '测灵根时吞噬残魂',
      status: 'completed',
      prerequisites: [],
      causalOutcome: '获得上古功法',
      relatedEntityIds: ['entity:lin-fan'],
      emotionalPolarity: 0.8,
      createdAt: 1000,
      updatedAt: 1000,
    })

    // 3. 写入 Promise 伏笔
    await db.put<PromiseLedgerEntry>('promiseLedger', {
      id: 'promise:sword-origin',
      projectId: workspaceId,
      clueName: '残剑身世',
      tier: 'main_plot',
      plantChapter: 1,
      plantNote: '后山残剑内蕴神凰',
      dueChapterLimit: 20,
      softDeadline: 15,
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: ['entity:lin-fan'],
      relatedChapterIds: [],
      createdAt: 1000,
      updatedAt: 1000,
    })

    // 4. 执行物化
    const state = await storyStateMaterializer.materialize(workspaceId)
    expect(state).toBeDefined()
    expect(state!.revision).toBe(1)

    // 验证 entities 物化
    expect(state!.entities['entity:lin-fan']).toBeDefined()
    expect(state!.entities['entity:lin-fan'].name).toBe('林凡')
    expect(state!.entities['entity:lin-fan'].kind).toBe('character')
    expect(state!.entities['entity:lin-fan'].aliases).toEqual(['凡哥', '少宗主'])

    // 验证 timelines 与 events 物化
    expect(state!.timelines['timeline:main']).toBeDefined()
    expect(state!.timelines['timeline:main'].label).toBe('宗门崛起主线')
    expect(state!.events['event:awakening']).toBeDefined()
    expect(state!.events['event:awakening'].title).toBe('觉醒仪式')
    expect(state!.events['event:awakening'].occurredAt).toBe(1)

    // 验证 promises 物化
    expect(state!.promises['promise:sword-origin']).toBeDefined()
    expect(state!.promises['promise:sword-origin'].statement).toBe('后山残剑内蕴神凰')
    expect(state!.promises['promise:sword-origin'].status).toBe('open')

    // 验证落库持久化能够重新载入
    const loadedState = await indexedDbStoryStateStore.load(workspaceId)
    expect(loadedState).toBeDefined()
    expect(loadedState!.revision).toBe(1)
    expect(loadedState!.entities['entity:lin-fan'].name).toBe('林凡')
  })

  it('materializes calendar, geography, faction, and power plugin facts', async () => {
    await db.put<MultiCalendarProjectRecord>('multiCalendars', {
      id: 'calendar-project-1',
      projectId: workspaceId,
      calendars: [
        {
          id: 'ancient',
          name: '上古灵历',
          epochOffsetDays: 0,
          monthsPerYear: 12,
          daysPerMonth: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        },
      ],
      chronologyEvents: [
        {
          chapterId: 'chapter-1',
          chapterOrder: 1,
          chapterTitle: '启程',
          timePoint: {
            calendarId: 'ancient',
            year: 1,
            month: 1,
            day: 3,
            absoluteDayIndex: 2,
          },
          eventSummary: '主角启程',
        },
      ],
      updatedAt: 1000,
    })
    await db.put<GeoMapGridRecord>('geoMapGrids', {
      id: 'map-1',
      projectId: workspaceId,
      locationId: 'loc-world',
      scaleKmPerCell: 10,
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      occupiedCells: [{ x: 0, y: 0, terrainType: 'city' }],
      linkedOverlays: { activeCharacterIds: [], foreshadowIds: [], timelineEventIds: [] },
      updatedAt: 1000,
    })
    await db.put<FactionDiplomacyRecord>('factionDiplomacies', {
      id: 'diplomacy-1',
      projectId: workspaceId,
      factionAId: 'faction-a',
      factionAName: '甲宗',
      factionBId: 'faction-b',
      factionBName: '乙门',
      stance: 'hostile',
      reputationScore: -40,
      updatedAt: 1000,
    })
    await db.put<PowerTierSystem>('powerTierSystems', {
      projectId: workspaceId,
      systemName: '九境体系',
      tiers: ['炼气', '筑基'],
      specialModifiers: [],
      updatedAt: 1000,
    })
    await db.put<ChapterBeatPlan>('sceneBeats', {
      id: 'plan-1',
      projectId: workspaceId,
      chapterId: 'chapter-1',
      targetWordCount: 3000,
      beats: [
        {
          id: 'beat-1',
          chapterId: 'chapter-1',
          order: 0,
          beatType: 'goal',
          title: '启程目标',
          goalOrConflict: '离开宗门',
          budgetWordRatio: 0.25,
          emotionalIn: 0,
          emotionalOut: 0.2,
          isCompleted: false,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    })
    await db.put<ExpectationContract>('expectationContracts', {
      id: 'expectation-1',
      projectId: workspaceId,
      chapterId: 'chapter-1',
      title: '必须偿还代价',
      intensity: 4,
      status: 'broken',
      plantedChapter: 1,
      promisedResolveChapter: 3,
      notes: '不能无代价取胜',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const state = await storyStateMaterializer.materialize(workspaceId)

    expect(state!.entities['calendar:calendar-project-1:ancient']).toMatchObject({
      kind: 'calendar',
      name: '上古灵历',
    })
    expect(state!.events['calendar-event:calendar-project-1:chapter-1']).toMatchObject({
      type: 'chronology-event',
      title: '主角启程',
      occurredAt: 2,
    })
    expect(state!.entities['geography-map:map-1']).toMatchObject({
      kind: 'geography-map',
      name: 'loc-world',
    })
    expect(state!.relations['faction-diplomacy:diplomacy-1']).toMatchObject({
      sourceEntityId: 'faction-a',
      targetEntityId: 'faction-b',
      type: 'diplomacy:hostile',
    })
    expect(state!.entities[`power-system:${workspaceId}`]).toMatchObject({
      kind: 'power-system',
      name: '九境体系',
    })
    expect(state!.scenes['scene:plan-1']).toMatchObject({
      title: '场景节拍：chapter-1',
      documentId: 'chapter-1',
      blockIds: ['beat-1'],
    })
    expect(state!.constraints['constraint:expectation:expectation-1']).toMatchObject({
      type: 'expectation:broken',
      description: '必须偿还代价：不能无代价取胜',
      severity: 'error',
      subjectIds: ['chapter-1'],
    })
  })

  it('idempotent when no domain changes occur', async () => {
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:sample',
      projectId: workspaceId,
      name: '样本',
      aliases: [],
      category: 'item',
      attributes: {},
      relations: [],
      summary: '物品',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const firstState = await storyStateMaterializer.materialize(workspaceId)
    expect(firstState!.revision).toBe(1)

    // 再次调用，无任何修改时不增加 revision
    const secondState = await storyStateMaterializer.materialize(workspaceId)
    expect(secondState!.revision).toBe(1)
  })

  it('projects codex relations into StoryState.relations with deterministic IDs', async () => {
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:master',
      projectId: workspaceId,
      name: '青云道人',
      aliases: [],
      category: 'character',
      attributes: {},
      relations: [
        {
          targetId: 'entity:disciple',
          targetName: '叶凡',
          relationType: '师徒',
          description: '衣钵相传',
        },
      ],
      summary: '掌教真尊',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const state = await storyStateMaterializer.materialize(workspaceId)
    expect(state).toBeDefined()
    const expectedRelId = 'codex-rel:entity:master:entity:disciple:师徒'
    expect(state!.relations[expectedRelId]).toBeDefined()
    expect(state!.relations[expectedRelId].sourceEntityId).toBe('entity:master')
    expect(state!.relations[expectedRelId].targetEntityId).toBe('entity:disciple')
    expect(state!.relations[expectedRelId].type).toBe('师徒')
    expect(state!.relations[expectedRelId].attributes).toEqual({ description: '衣钵相传' })
  })

  it('prunes deleted codex relations so deleted relations do not remain as ghosts in StoryState', async () => {
    // 1. 创建带有关系的实体
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:char-a',
      projectId: workspaceId,
      name: '甲',
      aliases: [],
      category: 'character',
      attributes: {},
      relations: [
        {
          targetId: 'entity:char-b',
          targetName: '乙',
          relationType: '同门',
          description: '',
        },
      ],
      summary: '',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const initial = await storyStateMaterializer.materialize(workspaceId)
    const relId = 'codex-rel:entity:char-a:entity:char-b:同门'
    expect(initial!.relations[relId]).toBeDefined()

    // 2. 移除该实体的关系并重新保存
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:char-a',
      projectId: workspaceId,
      name: '甲',
      aliases: [],
      category: 'character',
      attributes: {},
      relations: [],
      summary: '',
      createdAt: 1000,
      updatedAt: 2000,
    })

    // 3. 重新物化，确保关系被干净删除，不遗留幽灵
    const updated = await storyStateMaterializer.materialize(workspaceId)
    expect(updated!.relations[relId]).toBeUndefined()
  })

  it('fails closed and does not advance sourceRevision cursor if store.save fails', async () => {
    await db.put<CodexEntity>('codexEntities', {
      id: 'entity:cursor-test',
      projectId: workspaceId,
      name: '游标测试',
      aliases: [],
      category: 'character',
      attributes: {},
      relations: [],
      summary: '',
      createdAt: 1000,
      updatedAt: 1000,
    })

    // 模拟 store.save 失败
    const originalSave = indexedDbStoryStateStore.save
    indexedDbStoryStateStore.save = (async () => {
      throw new Error('Store save failed')
    }) as any

    try {
      await expect(storyStateMaterializer.materialize(workspaceId)).rejects.toThrow(
        'Store save failed',
      )
    } finally {
      indexedDbStoryStateStore.save = originalSave
    }

    // 此时 sourceRevisions 未被推高，下一次修复后 materialize 依然会生效
    const recovered = await storyStateMaterializer.materialize(workspaceId)
    expect(recovered).toBeDefined()
    expect(recovered!.entities['entity:cursor-test']).toBeDefined()
  })
})
