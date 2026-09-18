import type { DistilledStoryFacts } from '../results/taskResults'
import type { SourceEvidence, Provenance } from '../../domain/story/provenance'
import {
  codexApplicationService,
  promiseApplicationService,
  timelineApplicationService,
} from '../../services/domainApplicationServices'
import type { CodexEntity } from '../../plugins/living-codex/types'
import type { PromiseLedgerEntry } from '../../plugins/promise-ledger/types'
import type { TimelineNode } from '../../plugins/timeline-grid/types'
import { clock } from '../../adapters/clock'
import { idGenerator } from '../../adapters/idGenerator'
import {
  distillationReviewStore,
  type DistillationItem,
  type DistillationItemStatus,
} from './distillationReviewStore'

export type { DistillationItem, DistillationItemStatus }

/**
 * Distillation Review Inbox (事实审查收件箱 - Durable First)
 *
 * 职责：
 * 1. 汇聚 AI 事实蒸馏任务提取的新事实候选（实体、事件、伏笔）；
 * 2. 状态持久化存储于 IndexedDB (DistillationReviewStore)，关闭/重启后 pending 列表不丢失；
 * 3. 支持完整的审校生命周期决断：
 *    - accept (采纳为正史，factLevel='canonical-fact'，写入对应领域服务)
 *    - keepHypothesis (保留为推测，factLevel='hypothesis'，非正典 StoryState)
 *    - mergeIntoEntity (合并到已有实体)
 *    - reject (拒绝并标记持久化)
 */
export class DistillationReviewInbox {
  private memoryCache: Map<string, DistillationItem> = new Map()

  /**
   * 将任务蒸馏结果转换为审查项并入箱（实体、事件、伏笔全量捕获并落盘）
   */
  public ingestDistilledFacts(
    workspaceId: string,
    taskId: string,
    facts: DistilledStoryFacts,
    evidence?: SourceEvidence[],
  ): DistillationItem[] {
    const now = clock.now()
    const confidence = facts.confidence ?? 0.85
    const ingested: DistillationItem[] = []

    // 1. 实体候选
    for (const entity of facts.entities || []) {
      const id = idGenerator.generate('distill-item')
      const item: DistillationItem = {
        id,
        workspaceId,
        taskId,
        category: 'entity',
        name: entity.name,
        summary: `AI 提炼${entity.kind || '实体'}：${entity.name}`,
        kind: entity.kind,
        attributes: entity.attributes,
        confidence,
        evidence: evidence ? [...evidence] : undefined,
        status: 'pending',
        createdAt: now,
      }
      this.memoryCache.set(id, item)
      void distillationReviewStore.save(item)
      ingested.push(item)
    }

    // 2. 事件候选 (facts.events)
    for (const event of facts.events || []) {
      const id = idGenerator.generate('distill-item')
      const eventName = event.type
        ? `[${event.type}] ${event.description || '事件'}`
        : event.description || '关键事件'
      const item: DistillationItem = {
        id,
        workspaceId,
        taskId,
        category: 'event',
        name: eventName,
        summary: event.description || eventName,
        kind: event.type,
        attributes: event.entityIds ? { entityIds: event.entityIds } : undefined,
        confidence,
        evidence: evidence ? [...evidence] : undefined,
        status: 'pending',
        createdAt: now,
      }
      this.memoryCache.set(id, item)
      void distillationReviewStore.save(item)
      ingested.push(item)
    }

    // 3. 伏笔候选
    for (const promise of facts.promises || []) {
      const id = idGenerator.generate('distill-item')
      const item: DistillationItem = {
        id,
        workspaceId,
        taskId,
        category: 'promise',
        name: promise.statement,
        summary: `AI 提炼伏笔：${promise.statement}`,
        confidence,
        evidence: evidence ? [...evidence] : undefined,
        status: 'pending',
        createdAt: now,
      }
      this.memoryCache.set(id, item)
      void distillationReviewStore.save(item)
      ingested.push(item)
    }

    return ingested
  }

  public async restoreFromStorage(workspaceId: string): Promise<void> {
    const items = await distillationReviewStore.list(workspaceId)
    for (const it of items) {
      this.memoryCache.set(it.id, it)
    }
  }

  public listPending(workspaceId: string): DistillationItem[] {
    return Array.from(this.memoryCache.values()).filter(
      (item) => item.workspaceId === workspaceId && item.status === 'pending',
    )
  }

  public listAll(workspaceId: string): DistillationItem[] {
    return Array.from(this.memoryCache.values()).filter((item) => item.workspaceId === workspaceId)
  }

  public getItem(id: string): DistillationItem | undefined {
    return this.memoryCache.get(id)
  }

  /**
   * 采纳提议：将提议转化为权威领域实体/事件/伏笔并落库，提升为 canonical-fact
   */
  public async accept(
    itemId: string,
    overrides?: { name?: string; summary?: string; attributes?: Record<string, unknown> },
  ): Promise<void> {
    const item = this.memoryCache.get(itemId) ?? (await this.loadItem(itemId))
    if (!item) throw new Error(`DistillationItem not found: ${itemId}`)
    if (item.status !== 'pending') {
      throw new Error(`Cannot accept item in '${item.status}' status`)
    }

    const now = clock.now()
    const finalName = overrides?.name ?? item.name
    const finalSummary = overrides?.summary ?? item.summary
    const finalAttributes = overrides?.attributes ?? item.attributes ?? {}

    const provenance: Provenance = {
      sourceType: 'ai-proposed',
      factLevel: 'proposal',
      evidence: item.evidence ? [...item.evidence] : undefined,
      createdAt: item.createdAt,
    }

    if (item.category === 'entity') {
      const categoryMap: Record<string, 'character' | 'item' | 'location' | 'faction'> = {
        character: 'character',
        item: 'item',
        location: 'location',
        faction: 'faction',
      }
      const category = (item.kind && categoryMap[item.kind]) || 'item'

      const codexEntity: CodexEntity = {
        id: idGenerator.generate('codex'),
        projectId: item.workspaceId,
        name: finalName,
        aliases: [],
        category,
        attributes: finalAttributes,
        relations: [],
        summary: finalSummary,
        createdAt: now,
        updatedAt: now,
        provenance,
      } as any

      await codexApplicationService.saveEntity(codexEntity, 'ai-accepted')
    } else if (item.category === 'event') {
      const timelineNode: TimelineNode = {
        id: idGenerator.generate('timeline-node'),
        projectId: item.workspaceId,
        threadId: 'main-thread',
        chapterOrder: 1,
        eventTitle: finalName,
        summary: finalSummary,
        status: 'drafted',
        prerequisites: [],
        causalOutcome: '',
        relatedEntityIds: (finalAttributes.entityIds as string[]) || [],
        emotionalPolarity: 0,
        createdAt: now,
        updatedAt: now,
        provenance,
      } as any

      await timelineApplicationService.saveNode(timelineNode, 'ai-accepted')
    } else if (item.category === 'promise') {
      const promiseEntry: PromiseLedgerEntry = {
        id: idGenerator.generate('promise'),
        projectId: item.workspaceId,
        clueName: finalName,
        tier: 'sub_plot',
        plantChapter: 1,
        plantNote: finalSummary,
        dueChapterLimit: 20,
        softDeadline: 15,
        status: 'planted',
        memoryDecayLambda: 0.05,
        progressHistory: [],
        relatedEntityIds: [],
        relatedChapterIds: [],
        createdAt: now,
        updatedAt: now,
        provenance,
      } as any

      await promiseApplicationService.savePromise(promiseEntry, 'ai-accepted')
    }

    item.status = 'accepted'
    item.resolvedAt = now
    this.memoryCache.set(item.id, item)
    await distillationReviewStore.save(item)
  }

  /**
   * 保留为推测：写入领域实体，但标记为 hypothesis / 非 canonical
   */
  public async keepHypothesis(itemId: string): Promise<void> {
    const item = this.memoryCache.get(itemId) ?? (await this.loadItem(itemId))
    if (!item) throw new Error(`DistillationItem not found: ${itemId}`)
    if (item.status !== 'pending') {
      throw new Error(`Cannot update item in '${item.status}' status`)
    }

    const now = clock.now()
    if (item.category === 'entity') {
      const categoryMap: Record<string, 'character' | 'item' | 'location' | 'faction'> = {
        character: 'character',
        item: 'item',
        location: 'location',
        faction: 'faction',
      }
      const category = (item.kind && categoryMap[item.kind]) || 'item'

      const codexEntity: CodexEntity = {
        id: idGenerator.generate('codex'),
        projectId: item.workspaceId,
        name: item.name,
        aliases: [],
        category,
        attributes: item.attributes ?? {},
        relations: [],
        summary: item.summary,
        createdAt: now,
        updatedAt: now,
        provenance: {
          sourceType: 'derived',
          factLevel: 'hypothesis',
          evidence: item.evidence ? [...item.evidence] : undefined,
          createdAt: item.createdAt,
        },
      } as any

      await codexApplicationService.saveEntity(codexEntity, 'demo')
    }

    item.status = 'hypothesis'
    item.resolvedAt = now
    this.memoryCache.set(item.id, item)
    await distillationReviewStore.save(item)
  }

  /**
   * 合并到已有实体
   */
  public async mergeIntoEntity(itemId: string, targetEntity: CodexEntity): Promise<void> {
    const item = this.memoryCache.get(itemId) ?? (await this.loadItem(itemId))
    if (!item) throw new Error(`DistillationItem not found: ${itemId}`)
    if (item.status !== 'pending') {
      throw new Error(`Cannot merge item in '${item.status}' status`)
    }

    const now = clock.now()
    const updatedAliases = Array.from(new Set([...targetEntity.aliases, item.name]))
    const updatedSummary = `${targetEntity.summary}\n【提炼补充】：${item.summary}`.trim()
    const mergedEntity: CodexEntity = {
      ...targetEntity,
      aliases: updatedAliases,
      summary: updatedSummary,
      updatedAt: now,
    }

    await codexApplicationService.saveEntity(mergedEntity, 'author-confirmed')

    item.status = 'merged'
    item.mergedIntoId = targetEntity.id
    item.resolvedAt = now
    this.memoryCache.set(item.id, item)
    await distillationReviewStore.save(item)
  }

  public async reject(itemId: string): Promise<void> {
    const item = this.memoryCache.get(itemId) ?? (await this.loadItem(itemId))
    if (!item) throw new Error(`DistillationItem not found: ${itemId}`)
    item.status = 'rejected'
    item.resolvedAt = clock.now()
    this.memoryCache.set(item.id, item)
    await distillationReviewStore.save(item)
  }

  public async clear(workspaceId?: string): Promise<void> {
    if (workspaceId) {
      await distillationReviewStore.clear(workspaceId)
      for (const [id, item] of this.memoryCache.entries()) {
        if (item.workspaceId === workspaceId) {
          this.memoryCache.delete(id)
        }
      }
    } else {
      this.memoryCache.clear()
    }
  }

  private async loadItem(id: string): Promise<DistillationItem | undefined> {
    return this.memoryCache.get(id)
  }
}

export const distillationReviewInbox = new DistillationReviewInbox()
