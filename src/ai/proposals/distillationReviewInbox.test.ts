import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DistillationReviewInbox } from './distillationReviewInbox'
import { db } from '../../db/indexedDB'
import type { CodexEntity } from '../../plugins/living-codex/types'
import type { PromiseLedgerEntry } from '../../plugins/promise-ledger/types'
import { indexedDbStoryStateStore } from '../../adapters/indexedDbStoryStateStore'
import { distillationReviewStore } from './distillationReviewStore'

describe('DistillationReviewInbox', () => {
  const workspaceId = 'proj-inbox-test'
  let inbox: DistillationReviewInbox

  beforeEach(async () => {
    inbox = new DistillationReviewInbox()
    await distillationReviewStore.clear(workspaceId)
    for (const e of await db.getAll<CodexEntity>('codexEntities')) {
      if (e.projectId === workspaceId) await db.delete('codexEntities', e.id)
    }
    for (const p of await db.getAll<PromiseLedgerEntry>('promiseLedger')) {
      if (p.projectId === workspaceId) await db.delete('promiseLedger', p.id)
    }
    await db.delete('settingsKV', `storyState::${workspaceId}`)
  })

  it('ingests distilled entities and promises as pending review items', async () => {
    const items = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-1', {
      summary: '提取结果',
      entities: [
        {
          kind: 'character',
          name: '李沧澜',
          attributes: { sect: '青云门' },
          sourceDocumentId: 'doc-1',
          sourceBlockId: 'b-1',
          sourceRevision: 2,
          evidence: [{ documentId: 'doc-1', blockId: 'b-1', excerpt: '李沧澜手持紫青双剑' }],
        },
        {
          kind: 'item',
          name: '紫青双剑',
          sourceDocumentId: 'doc-2',
          sourceBlockId: 'b-3',
          sourceRevision: 5,
          evidence: [{ documentId: 'doc-2', blockId: 'b-3', excerpt: '紫青双剑发出青光' }],
        },
      ],
      events: [],
      promises: [
        {
          statement: '紫青双剑合璧',
          sourceDocumentId: 'doc-3',
          sourceRevision: 6,
          evidence: [{ documentId: 'doc-3', excerpt: '双剑合璧后可破阵' }],
        },
      ],
    })

    expect(items).toHaveLength(3)
    const pending = inbox.listPending(workspaceId)
    expect(pending).toHaveLength(3)
    expect(pending.every((item) => item.status === 'pending')).toBe(true)
    expect(pending.map((item) => item.evidence?.[0]?.excerpt)).toEqual([
      '李沧澜手持紫青双剑',
      '紫青双剑发出青光',
      '双剑合璧后可破阵',
    ])
    expect(pending.map((item) => item.sourceRevision)).toEqual([2, 5, 6])
  })

  it('accepts an entity proposal: upgrades factLevel to canonical-fact and materializes into StoryState', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-2', {
      summary: '新人物提取',
      entities: [
        {
          kind: 'character',
          name: '苏白',
          sourceDocumentId: 'doc-ch2',
          sourceBlockId: 'block-sb',
          sourceRevision: 8,
          evidence: [
            {
              documentId: 'doc-ch2',
              blockId: 'block-sb',
              excerpt: '只见苏白白衣胜雪',
              semanticFrom: 12,
              semanticTo: 20,
            },
          ],
        },
      ],
      events: [],
      promises: [],
    })

    await inbox.accept(item.id)

    expect(item.status).toBe('accepted')

    // 检查 Codex 数据库
    const allCodex = await db.getAll<CodexEntity>('codexEntities')
    const saved = allCodex.find((e) => e.projectId === workspaceId && e.name === '苏白')
    expect(saved).toBeDefined()
    expect(saved!.provenance).toBeDefined()
    // 溯源升级：来源仍为 ai-extracted，但 factLevel 为 canonical-fact，且保留原始 evidence
    expect(saved!.provenance.sourceType).toBe('ai-extracted')
    expect(saved!.provenance.factLevel).toBe('canonical-fact')
    expect(saved!.provenance.evidence?.[0].excerpt).toBe('只见苏白白衣胜雪')
    expect(saved!.provenance).toMatchObject({
      sourceDocumentId: 'doc-ch2',
      sourceBlockId: 'block-sb',
      sourceRevision: 8,
    })

    // 检查已自动物化进 StoryState 读模型
    const state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state).toBeDefined()
    expect(state!.entities[saved!.id]).toBeDefined()
    expect(state!.entities[saved!.id].provenance.factLevel).toBe('canonical-fact')
  })

  it('keeps the fact, change log and review status unchanged if review resolution cannot be written', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-atomic-review', {
      summary: '事务验收',
      entities: [{ kind: 'character', name: '事务人物' }],
      events: [],
      promises: [],
    })
    const changesBefore = (await db.getAll<any>('domainChangeSets')).filter(
      (change) => change.workspaceId === workspaceId,
    )
    const originalPut = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (value, key) {
      if (
        this.name === 'settingsKV' &&
        value?.value?.id === item.id &&
        value.value.status === 'accepted'
      ) {
        throw new Error('review disk full')
      }
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key)
    })
    try {
      await expect(inbox.accept(item.id)).rejects.toThrow('review disk full')
      expect(item.status).toBe('pending')
      expect((await distillationReviewStore.get(workspaceId, item.id))?.status).toBe('pending')
      expect(
        (await db.getAll<CodexEntity>('codexEntities')).filter(
          (entity) => entity.projectId === workspaceId && entity.name === '事务人物',
        ),
      ).toHaveLength(0)
      expect(
        (await db.getAll<any>('domainChangeSets')).filter(
          (change) => change.workspaceId === workspaceId,
        ),
      ).toEqual(changesBefore)
    } finally {
      put.mockRestore()
    }
    await inbox.accept(item.id)
    expect(
      (await db.getAll<CodexEntity>('codexEntities')).filter(
        (entity) => entity.projectId === workspaceId && entity.name === '事务人物',
      ),
    ).toHaveLength(1)
    expect((await distillationReviewStore.get(workspaceId, item.id))?.status).toBe('accepted')
  })

  it('allows only one concurrent resolution across inbox instances', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-concurrent-review', {
      summary: '重复采纳验收',
      entities: [{ kind: 'character', name: '唯一人物' }],
      events: [],
      promises: [],
    })
    const restored = new DistillationReviewInbox()
    await restored.restoreFromStorage(workspaceId)
    const results = await Promise.allSettled([inbox.accept(item.id), restored.accept(item.id)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(
      (await db.getAll<CodexEntity>('codexEntities')).filter(
        (entity) => entity.projectId === workspaceId && entity.name === '唯一人物',
      ),
    ).toHaveLength(1)
  })

  it('rejects a review item without modifying canonical domain data', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-3', {
      summary: '错误提取',
      entities: [{ kind: 'character', name: '假名字' }],
      events: [],
      promises: [],
    })

    await inbox.reject(item.id)
    expect(item.status).toBe('rejected')
    expect(inbox.listPending(workspaceId)).toHaveLength(0)

    const allCodex = await db.getAll<CodexEntity>('codexEntities')
    const found = allCodex.find((e) => e.name === '假名字')
    expect(found).toBeUndefined()
  })

  it('ingests and accepts events into timelineNodes with ai-accepted provenance', async () => {
    const [eventItem] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-4', {
      summary: '战斗事件',
      entities: [],
      events: [{ type: 'combat', description: '青云门大战黑水玄蛇', entityIds: ['entity-snake'] }],
      promises: [],
    })

    expect(eventItem.category).toBe('event')
    await inbox.accept(eventItem.id)
    expect(eventItem.status).toBe('accepted')

    const nodes = await db.getAll<any>('timelineNodes')
    const savedNode = nodes.find(
      (n) => n.projectId === workspaceId && n.eventTitle.includes('黑水玄蛇'),
    )
    expect(savedNode).toBeDefined()
    expect(savedNode!.provenance.factLevel).toBe('canonical-fact')
    expect(savedNode!.provenance.sourceType).toBe('ai-extracted')
  })

  it('uses the source chapter position for accepted events and promises across volumes', async () => {
    const sourceWorkspace = 'proj-inbox-source-chapter-order'
    const volumes = [
      {
        id: 'source-volume-1',
        projectId: sourceWorkspace,
        title: '第一卷',
        order: 0,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'source-volume-2',
        projectId: sourceWorkspace,
        title: '第二卷',
        order: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ]
    const chapters = [
      {
        id: 'source-chapter-1',
        projectId: sourceWorkspace,
        volumeId: volumes[0].id,
        title: '第一章',
        content: '第一章正文',
        wordCount: 5,
        order: 0,
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'source-chapter-2',
        projectId: sourceWorkspace,
        volumeId: volumes[0].id,
        title: '第二章',
        content: '第二章正文',
        wordCount: 5,
        order: 1,
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'source-chapter-3',
        projectId: sourceWorkspace,
        volumeId: volumes[1].id,
        title: '第三章',
        content: '本章来源引文',
        wordCount: 6,
        order: 0,
        revision: 4,
        createdAt: 1,
        updatedAt: 1,
      },
    ]
    for (const volume of volumes) await db.put('volumes', volume)
    for (const chapter of chapters) await db.put('chapters', chapter)

    const [eventItem, promiseItem] = await inbox.ingestDistilledFacts(
      sourceWorkspace,
      'task-distill-source-chapter-order',
      {
        summary: '来源章节位置',
        entities: [],
        events: [
          {
            type: 'combat',
            description: '来源章节中的战斗',
            sourceDocumentId: 'source-chapter-3',
            sourceRevision: 4,
            evidence: [
              {
                documentId: 'source-chapter-3',
                excerpt: '本章来源引文',
                semanticFrom: 0,
                semanticTo: 6,
              },
            ],
          },
        ],
        promises: [
          {
            statement: '来源章节中的伏笔',
            sourceDocumentId: 'source-chapter-3',
            sourceRevision: 4,
            evidence: [
              {
                documentId: 'source-chapter-3',
                excerpt: '本章来源引文',
                semanticFrom: 0,
                semanticTo: 6,
              },
            ],
          },
        ],
      },
    )

    eventItem.attributes = { chapterOrder: 90 }
    promiseItem.attributes = { plantChapter: 90 }
    await inbox.accept(eventItem.id)
    await inbox.accept(promiseItem.id)

    const nodes = await db.getAll<any>('timelineNodes')
    const savedNode = nodes.find(
      (node) => node.projectId === sourceWorkspace && node.eventTitle.includes('来源章节中的战斗'),
    )
    const promises = await db.getAll<PromiseLedgerEntry>('promiseLedger')
    const savedPromise = promises.find(
      (entry) => entry.projectId === sourceWorkspace && entry.clueName === '来源章节中的伏笔',
    )
    expect(savedNode?.chapterOrder).toBe(3)
    expect(savedPromise?.plantChapter).toBe(3)
    expect(savedPromise?.tier).toBe('side_arc')

    const [unplacedEvent, unplacedPromise] = await inbox.ingestDistilledFacts(
      sourceWorkspace,
      'task-unplaced',
      {
        summary: '尚无出处的建议',
        entities: [],
        events: [{ description: '尚未定位的事件' }],
        promises: [{ statement: '尚未定位的伏笔' }],
      },
    )
    unplacedEvent.attributes = { chapterOrder: 90 }
    unplacedPromise.attributes = { plantChapter: 90 }
    await inbox.accept(unplacedEvent.id)
    await inbox.accept(unplacedPromise.id)

    const [placedEvent, placedPromise] = await inbox.ingestDistilledFacts(
      sourceWorkspace,
      'task-author-placed',
      {
        summary: '作者指定位置',
        entities: [],
        events: [{ description: '作者定位的事件' }],
        promises: [{ statement: '作者定位的伏笔' }],
      },
    )
    await expect(
      inbox.accept(placedEvent.id, { chapterId: 'chapter-from-another-project' }),
    ).rejects.toThrow('不属于当前作品')
    expect(placedEvent.status).toBe('pending')
    await inbox.accept(placedEvent.id, { chapterId: 'source-chapter-2' })
    await inbox.accept(placedPromise.id, { chapterId: 'source-chapter-2' })

    const resolvedNodes = (await db.getAll<any>('timelineNodes')).filter(
      (node) => node.projectId === sourceWorkspace,
    )
    const resolvedPromises = (await db.getAll<PromiseLedgerEntry>('promiseLedger')).filter(
      (entry) => entry.projectId === sourceWorkspace,
    )
    expect(resolvedNodes.find((node) => node.eventTitle === '尚未定位的事件')?.chapterOrder).toBe(0)
    expect(
      resolvedPromises.find((entry) => entry.clueName === '尚未定位的伏笔')?.plantChapter,
    ).toBe(0)
    const authorPlacedNode = resolvedNodes.find((node) => node.eventTitle === '作者定位的事件')
    const authorPlacedPromise = resolvedPromises.find(
      (entry) => entry.clueName === '作者定位的伏笔',
    )
    expect(authorPlacedNode?.chapterOrder).toBe(2)
    expect(authorPlacedPromise?.plantChapter).toBe(2)
    expect(authorPlacedNode?.provenance.sourceDocumentId).toBeUndefined()
    expect(authorPlacedPromise?.provenance.sourceDocumentId).toBeUndefined()

    for (const node of resolvedNodes) await db.delete('timelineNodes', node.id)
    for (const entry of resolvedPromises) await db.delete('promiseLedger', entry.id)
    for (const chapter of chapters) await db.delete('chapters', chapter.id)
    for (const volume of volumes) await db.delete('volumes', volume.id)
    await db.delete('settingsKV', `storyState::${sourceWorkspace}`)
    await distillationReviewStore.clear(sourceWorkspace)
    await inbox.clear(sourceWorkspace)
  })

  it('supports keepHypothesis: saves to codex as non-canonical hypothesis', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-5', {
      summary: '推测实体',
      entities: [
        {
          kind: 'character',
          name: '神秘黑衣人',
          sourceDocumentId: 'chapter-9',
          sourceBlockId: 'block-6',
          sourceRevision: 12,
          evidence: [
            {
              documentId: 'chapter-9',
              blockId: 'block-6',
              excerpt: '黑衣人立于雨中',
              semanticFrom: 40,
              semanticTo: 47,
            },
          ],
        },
      ],
      events: [],
      promises: [],
    })

    await inbox.keepHypothesis(item.id)
    expect(item.status).toBe('hypothesis')

    const allCodex = await db.getAll<CodexEntity>('codexEntities')
    const saved = allCodex.find((e) => e.projectId === workspaceId && e.name === '神秘黑衣人')
    expect(saved).toBeDefined()
    expect(saved!.provenance.factLevel).toBe('hypothesis')
    expect(saved!.provenance).toMatchObject({
      sourceDocumentId: 'chapter-9',
      sourceBlockId: 'block-6',
      sourceRevision: 12,
      evidence: [{ documentId: 'chapter-9', excerpt: '黑衣人立于雨中' }],
    })
  })

  it('supports mergeIntoEntity: merges alias and summary into existing entity', async () => {
    const targetEntity: CodexEntity = {
      id: 'codex-existing-1',
      projectId: workspaceId,
      name: '万剑一',
      aliases: ['万前辈'],
      category: 'character',
      attributes: {},
      relations: [],
      summary: '青云门隐世宿老',
      createdAt: 1000,
      updatedAt: 1000,
      provenance: { sourceType: 'author', factLevel: 'canonical-fact', createdAt: 1000 },
    }
    await db.put('codexEntities', targetEntity)

    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-6', {
      summary: '别名提取',
      entities: [{ kind: 'character', name: '祖师祠堂老人' }],
      events: [],
      promises: [],
    })

    await inbox.mergeIntoEntity(item.id, targetEntity)
    expect(item.status).toBe('merged')
    expect(item.mergedIntoId).toBe(targetEntity.id)

    const updated = await db.get<CodexEntity>('codexEntities', targetEntity.id)
    expect(updated).toBeDefined()
    expect(updated!.aliases).toContain('祖师祠堂老人')
    expect(updated!.summary).toContain('【提炼补充】')
  })

  it('restores pending items from durable storage after simulated reload', async () => {
    await inbox.ingestDistilledFacts(workspaceId, 'task-distill-7', {
      summary: '持久化测试',
      entities: [
        {
          kind: 'item',
          name: '玄火鉴',
          sourceDocumentId: 'chapter-8',
          sourceRevision: 3,
          evidence: [{ documentId: 'chapter-8', excerpt: '玄火鉴现身' }],
        },
      ],
      events: [],
      promises: [],
    })

    // 新建一个全新实例模拟应用重启
    const reloadedInbox = new DistillationReviewInbox()
    expect(reloadedInbox.listPending(workspaceId)).toHaveLength(0)

    await reloadedInbox.restoreFromStorage(workspaceId)
    const pending = reloadedInbox.listPending(workspaceId)
    expect(pending).toHaveLength(1)
    expect(pending[0].name).toBe('玄火鉴')
    expect(pending[0]).toMatchObject({
      sourceDocumentId: 'chapter-8',
      sourceRevision: 3,
      evidence: [{ documentId: 'chapter-8', excerpt: '玄火鉴现身' }],
    })
  })
})
