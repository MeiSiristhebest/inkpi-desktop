import { describe, it, expect, beforeEach } from 'vitest'
import { DistillationReviewInbox } from './distillationReviewInbox'
import { db } from '../../db/indexedDB'
import type { CodexEntity } from '../../plugins/living-codex/types'
import type { PromiseLedgerEntry } from '../../plugins/promise-ledger/types'
import { indexedDbStoryStateStore } from '../../adapters/indexedDbStoryStateStore'

describe('DistillationReviewInbox', () => {
  const workspaceId = 'proj-inbox-test'
  let inbox: DistillationReviewInbox

  beforeEach(async () => {
    inbox = new DistillationReviewInbox()
    for (const e of await db.getAll<CodexEntity>('codexEntities')) {
      if (e.projectId === workspaceId) await db.delete('codexEntities', e.id)
    }
    for (const p of await db.getAll<PromiseLedgerEntry>('promiseLedger')) {
      if (p.projectId === workspaceId) await db.delete('promiseLedger', p.id)
    }
    await db.delete('settingsKV', `storyState::${workspaceId}`)
  })

  it('ingests distilled entities and promises as pending review items', () => {
    const items = inbox.ingestDistilledFacts(
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
    const [item] = inbox.ingestDistilledFacts(
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
    const [item] = inbox.ingestDistilledFacts(workspaceId, 'task-distill-3', {
      summary: '错误提取',
      entities: [{ kind: 'character', name: '假名字' }],
      events: [],
      promises: [],
    })

    inbox.reject(item.id)
    expect(item.status).toBe('rejected')
    expect(inbox.listPending(workspaceId)).toHaveLength(0)

    const allCodex = await db.getAll<CodexEntity>('codexEntities')
    const found = allCodex.find((e) => e.name === '假名字')
    expect(found).toBeUndefined()
  })
})
