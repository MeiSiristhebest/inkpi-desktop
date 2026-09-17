import type { DistilledStoryFacts } from '../results/taskResults'
import type { SourceEvidence, Provenance } from '../../domain/story/provenance'
import {
  codexApplicationService,
  promiseApplicationService,
} from '../../services/domainApplicationServices'
import type { CodexEntity } from '../../plugins/living-codex/types'
import type { PromiseLedgerEntry } from '../../plugins/promise-ledger/types'
import { clock } from '../../adapters/clock'
import { idGenerator } from '../../adapters/idGenerator'

export type DistillationItemStatus = 'pending' | 'accepted' | 'rejected'

export interface DistillationItem {
  id: string
  workspaceId: string
  taskId: string
  category: 'entity' | 'event' | 'promise'
  name: string
  summary: string
  kind?: string
  attributes?: Record<string, unknown>
  confidence: number
  evidence?: SourceEvidence[]
  status: DistillationItemStatus
  createdAt: number
}

/**
 * Distillation Review Inbox (事实审查收件箱)
 *
 * 职责：
 * 1. 汇聚 AI 事实蒸馏任务提取的新事实候选；
 * 2. 维持待审（pending）、已采纳（accepted）、已拒绝（rejected）的生命周期；
 * 3. 当作者确认采纳（accept）时，调用权威领域应用服务，附带原始证据并显式传入
 *    `intent = 'ai-accepted'`，将提案提升为 'canonical-fact' 并自动触发物化；
 * 4. 支持就地修改属性后再采纳。
 */
export class DistillationReviewInbox {
  private items: Map<string, DistillationItem> = new Map()

  /**
   * 将任务蒸馏结果转换为审查项并入箱
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
    for (const entity of facts.entities) {
      const id = idGenerator.generate('distill-item')
      const item: DistillationItem = {
        id,
        workspaceId,
        taskId,
        category: 'entity',
        name: entity.name,
        summary: `AI 提炼${entity.kind}：${entity.name}`,
        kind: entity.kind,
        attributes: entity.attributes,
        confidence,
        evidence: evidence ? [...evidence] : undefined,
        status: 'pending',
        createdAt: now,
      }
      this.items.set(id, item)
      ingested.push(item)
    }

    // 2. 伏笔候选
    for (const promise of facts.promises) {
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
      this.items.set(id, item)
      ingested.push(item)
    }

    return ingested
  }

  public listPending(workspaceId: string): DistillationItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.workspaceId === workspaceId && item.status === 'pending',
    )
  }

  public listAll(workspaceId: string): DistillationItem[] {
    return Array.from(this.items.values()).filter((item) => item.workspaceId === workspaceId)
  }

  public getItem(id: string): DistillationItem | undefined {
    return this.items.get(id)
  }

  /**
   * 采纳提议：将提议转化为权威领域实体并落库
   */
  public async accept(
    itemId: string,
    overrides?: { name?: string; summary?: string; attributes?: Record<string, unknown> },
  ): Promise<void> {
    const item = this.items.get(itemId)
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

      // 明确以 'ai-accepted' 写入，通过 resolveProvenance 将 factLevel 升级为 'canonical-fact'
      await codexApplicationService.saveEntity(codexEntity, 'ai-accepted')
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
  }

  public reject(itemId: string): void {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`DistillationItem not found: ${itemId}`)
    item.status = 'rejected'
  }

  public clear(): void {
    this.items.clear()
  }
}

export const distillationReviewInbox = new DistillationReviewInbox()
