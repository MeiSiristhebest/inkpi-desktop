import { describe, it, expect, beforeEach } from 'vitest'
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
    const items = await inbox.ingestDistilledFacts(
      workspaceId,
      'task-distill-1',
      {
        summary: '提取结果',
        entities: [
          { kind: 'character', name: '李沧澜', attributes: { sect: '青云门' } },
          { kind: 'item', name: '紫青双剑' },
        ],
        events: [],
        promises: [{ statement: '紫青双剑合璧' }],
      },
      [{ documentId: 'doc-1', blockId: 'b-1', excerpt: '李沧澜手持紫青双剑' }],
    )

    expect(items).toHaveLength(3)
    const pending = inbox.listPending(workspaceId)
    expect(pending).toHaveLength(3)
    expect(pending.every((item) => item.status === 'pending')).toBe(true)
    expect(pending[0].evidence?.[0].excerpt).toBe('李沧澜手持紫青双剑')
  })

  it('accepts an entity proposal: upgrades factLevel to canonical-fact and materializes into StoryState', async () => {
    const [item] = await inbox.ingestDistilledFacts(
      workspaceId,
      'task-distill-2',
      {
        summary: '新人物提取',
        entities: [{ kind: 'character', name: '苏白' }],
        events: [],
        promises: [],
      },
      [{ documentId: 'doc-ch2', excerpt: '只见苏白白衣胜雪' }],
    )

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

    // 检查已自动物化进 StoryState 读模型
    const state = await indexedDbStoryStateStore.load(workspaceId)
    expect(state).toBeDefined()
    expect(state!.entities[saved!.id]).toBeDefined()
    expect(state!.entities[saved!.id].provenance.factLevel).toBe('canonical-fact')
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

  it('supports keepHypothesis: saves to codex as non-canonical hypothesis', async () => {
    const [item] = await inbox.ingestDistilledFacts(workspaceId, 'task-distill-5', {
      summary: '推测实体',
      entities: [{ kind: 'character', name: '神秘黑衣人' }],
      events: [],
      promises: [],
    })

    await inbox.keepHypothesis(item.id)
    expect(item.status).toBe('hypothesis')

    const allCodex = await db.getAll<CodexEntity>('codexEntities')
    const saved = allCodex.find((e) => e.projectId === workspaceId && e.name === '神秘黑衣人')
    expect(saved).toBeDefined()
    expect(saved!.provenance.factLevel).toBe('hypothesis')
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
      entities: [{ kind: 'item', name: '玄火鉴' }],
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
  })
})
