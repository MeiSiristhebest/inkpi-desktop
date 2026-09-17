import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/indexedDB'
import { storyStateMaterializer } from './storyStateMaterializer'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'

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
