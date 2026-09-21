import { db } from '../db/indexedDB'
import {
  projectLegacyRecordsToStoryEntities,
  projectPluginRecordsToStoryState,
  type StoryPluginCollectionInput,
} from '../domain/story/pluginProjection'
import type { StoryState } from '../domain/story'
import { serializeStoryState } from '../domain/story/storyStateSerialization'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { StoryStateStore } from '../ports/storyStateStore'
import { storyStateEvents } from '../ports/storyStateEvents'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { NarrativeThread, TimelineNode } from '../plugins/timeline-grid/types'
import type { PromiseLedgerEntry } from '../plugins/promise-ledger/types'
import type { CardRecord, FormDataRecord, TableRowRecord } from '../types'
import type { GeoMapGridRecord } from '../ports/geoMapRepository'
import type { FactionDiplomacyRecord } from '../ports/factionDiplomacyRepository'
import type { MultiCalendarProjectRecord } from '../ports/multiCalendarRepository'
import type { PowerTierSystem } from '../ports/powerTierRepository'
import type { ChapterBeatPlan } from '../plugins/scene-beats/types'
import type { ExpectationContract } from '../ports/expectationRepository'
import { IndexedDbDomainChangeStore } from '../adapters/indexedDbDomainChangeStore'

const domainChangeStore = new IndexedDbDomainChangeStore()

/**
 * 生产级 StoryState 物化器（StoryState Production Materializer）
 * 职责：
 * 1. 从 IndexedDB 读取指定 workspaceId 的全部 canonical 插件领域数据；
 *    严格 fail-closed：数据库读取出错时不降级为空数组，避免清空读模型；
 * 2. 自动补充或规范化 provenance 字段（遵循 INV-05：事实源合规）；
 * 3. 提取 Codex 实体中的 relations 关系，分配确定性 ID 并投影入 StoryState.relations；
 * 4. 驱动 pure function projectPluginRecordsToStoryState() 计算 canonical StoryState；
 * 5. 工作区级串行化队列与折叠（Coalescing），防止并发物化写冲突与更新丢失；
 * 6. 维护 sourceWorkspaceRevision，支持 stale read 检查与补跑；
 * 7. 如果内容发生实质改变，递增 revision 并落入 StoryStateStore；
 * 8. 发布 storyStateEvents 通知 UI 与 AI 上下文完成实时状态同步。
 */
export class StoryStateMaterializer {
  private readonly store: StoryStateStore
  private workspaceQueues: Map<string, Promise<StoryState | undefined>> = new Map()
  private sourceRevisions: Map<string, number> = new Map()

  constructor(store: StoryStateStore = indexedDbStoryStateStore) {
    this.store = store
  }

  public async materialize(workspaceId: string): Promise<StoryState | undefined> {
    if (!workspaceId) return undefined

    const currentQueue = this.workspaceQueues.get(workspaceId) ?? Promise.resolve(undefined)
    const nextTask = currentQueue.then(
      () => this.runMaterialize(workspaceId),
      () => this.runMaterialize(workspaceId),
    )

    this.workspaceQueues.set(
      workspaceId,
      nextTask.catch(() => undefined),
    )
    return nextTask
  }

  public async materializeIfStale(workspaceId: string): Promise<StoryState | undefined> {
    if (!workspaceId) return undefined
    const latestWsRev = await domainChangeStore.latestRevision(workspaceId)
    const knownRev = this.sourceRevisions.get(workspaceId) ?? -1
    const existing = await this.store.load(workspaceId)

    if (!existing || knownRev < latestWsRev) {
      return this.materialize(workspaceId)
    }
    return existing
  }

  private async runMaterialize(workspaceId: string): Promise<StoryState | undefined> {
    // 1. 并发从持久化存储中读取 canonical 插件与 legacy 领域数据
    // 严格 fail-closed：如果任一读取失败，直接抛出，决不降级为 [] 导致冲掉 read model
    const [
      allEntities,
      allThreads,
      allNodes,
      allPromises,
      allFormData,
      allTableRows,
      allCardRecords,
      allCalendarProjects,
      allGeoMaps,
      allFactionDiplomacies,
      allPowerTierSystems,
      allSceneBeatPlans,
      allExpectationContracts,
      latestWsRev,
    ] = await Promise.all([
      db.getAll<CodexEntity>('codexEntities'),
      db.getAll<NarrativeThread>('narrativeThreads'),
      db.getAll<TimelineNode>('timelineNodes'),
      db.getAll<PromiseLedgerEntry>('promiseLedger'),
      db.getAll<FormDataRecord>('formData'),
      db.getAll<TableRowRecord>('tableRows'),
      db.getAll<CardRecord>('cardRecords'),
      db.getAll<MultiCalendarProjectRecord>('multiCalendars'),
      db.getAll<GeoMapGridRecord>('geoMapGrids'),
      db.getAll<FactionDiplomacyRecord>('factionDiplomacies'),
      db.getAll<PowerTierSystem>('powerTierSystems'),
      db.getAll<ChapterBeatPlan>('sceneBeats'),
      db.getAll<ExpectationContract>('expectationContracts'),
      domainChangeStore.latestRevision(workspaceId),
    ])

    // 按 workspaceId 严格过滤（遵循 INV-03: 数据永不串）
    const entities = allEntities.filter((e) => e.projectId === workspaceId)
    const threads = allThreads.filter((t) => t.projectId === workspaceId)
    const nodes = allNodes.filter((n) => n.projectId === workspaceId)
    const promises = allPromises.filter((p) => p.projectId === workspaceId)
    const formData = allFormData.filter((record) => record.projectId === workspaceId)
    const tableRows = allTableRows.filter((record) => record.projectId === workspaceId)
    const cardRecords = allCardRecords.filter((record) => record.projectId === workspaceId)
    const calendarProjects = allCalendarProjects.filter(
      (record) => record.projectId === workspaceId,
    )
    const geoMaps = allGeoMaps.filter((record) => record.projectId === workspaceId)
    const factionDiplomacies = allFactionDiplomacies.filter(
      (record) => record.projectId === workspaceId,
    )
    const powerTierSystems = allPowerTierSystems.filter(
      (record) => record.projectId === workspaceId,
    )
    const sceneBeatPlans = allSceneBeatPlans.filter((record) => record.projectId === workspaceId)
    const expectationContracts = allExpectationContracts.filter(
      (record) => record.projectId === workspaceId,
    )

    // 2. 遵循 INV-05 fail-closed 溯源保护：
    // 未显式提供可信 provenance 的历史/导入数据，降级标记为 'derived'/'hypothesis'，绝不静默伪造成 'canonical-fact'
    const fallbackProvenance = {
      sourceType: 'derived' as const,
      factLevel: 'hypothesis' as const,
    }

    const codexRecords = entities.map((e) => ({
      ...e,
      provenance: (e as any).provenance ?? fallbackProvenance,
    }))

    // 提取 Codex 实体中的 relations 关系，赋予确定性稳定 ID: codex-rel:${sourceId}:${targetId}:${relationType}
    const codexRelations = entities.flatMap((e) => {
      const entityProvenance = (e as any).provenance ?? fallbackProvenance
      return (e.relations || []).map((rel) => ({
        id: `codex-rel:${e.id}:${rel.targetId}:${rel.relationType}`,
        sourceEntityId: e.id,
        targetEntityId: rel.targetId,
        type: rel.relationType,
        attributes: rel.description ? { description: rel.description } : {},
        provenance: entityProvenance,
      }))
    })

    const threadRecords = threads.map((t) => ({
      ...t,
      provenance: (t as any).provenance ?? fallbackProvenance,
    }))

    const nodeRecords = nodes.map((n) => ({
      ...n,
      provenance: (n as any).provenance ?? fallbackProvenance,
    }))

    const promiseRecords = promises.map((p) => ({
      ...p,
      provenance: (p as any).provenance ?? fallbackProvenance,
    }))

    const calendarRecords = calendarProjects.flatMap((project) =>
      project.calendars.map((calendar) => ({
        id: `calendar:${project.id}:${calendar.id}`,
        name: calendar.name,
        projectId: project.projectId,
        calendarId: calendar.id,
        attributes: {
          projectId: project.projectId,
          calendarId: calendar.id,
          epochOffsetDays: calendar.epochOffsetDays,
          monthsPerYear: calendar.monthsPerYear,
          daysPerMonth: [...calendar.daysPerMonth],
          ...(calendar.leapRules === undefined ? {} : { leapRules: calendar.leapRules }),
        },
        provenance: calendar.provenance ?? project.provenance ?? fallbackProvenance,
      })),
    )

    const chronologyRecords = calendarProjects.flatMap((project) =>
      project.chronologyEvents.map((event) => ({
        id: `calendar-event:${project.id}:${event.chapterId}`,
        eventSummary: event.eventSummary,
        chapterId: event.chapterId,
        chapterOrder: event.chapterOrder,
        chapterTitle: event.chapterTitle,
        calendarId: event.timePoint.calendarId,
        year: event.timePoint.year,
        month: event.timePoint.month,
        day: event.timePoint.day,
        absoluteDayIndex: event.timePoint.absoluteDayIndex,
        attributes: {
          projectId: project.projectId,
          chapterId: event.chapterId,
          chapterOrder: event.chapterOrder,
          chapterTitle: event.chapterTitle,
          calendarId: event.timePoint.calendarId,
          year: event.timePoint.year,
          month: event.timePoint.month,
          day: event.timePoint.day,
        },
        provenance: event.provenance ?? project.provenance ?? fallbackProvenance,
      })),
    )

    const geoMapRecords = geoMaps.map((map) => ({
      id: `geography-map:${map.id}`,
      name: map.locationId,
      attributes: {
        projectId: map.projectId,
        locationId: map.locationId,
        ...(map.parentLocationId === undefined ? {} : { parentLocationId: map.parentLocationId }),
        scaleKmPerCell: map.scaleKmPerCell,
        bounds: map.bounds,
        occupiedCells: map.occupiedCells,
        fillColor: map.fillColor,
        linkedOverlays: map.linkedOverlays,
      },
      provenance: map.provenance ?? fallbackProvenance,
    }))

    const diplomacyRecords = factionDiplomacies.map((diplomacy) => ({
      id: `faction-diplomacy:${diplomacy.id}`,
      factionAId: diplomacy.factionAId,
      factionBId: diplomacy.factionBId,
      attributes: {
        projectId: diplomacy.projectId,
        factionAName: diplomacy.factionAName,
        factionBName: diplomacy.factionBName,
        stance: diplomacy.stance,
        reputationScore: diplomacy.reputationScore,
        ...(diplomacy.notes === undefined ? {} : { notes: diplomacy.notes }),
      },
      stance: diplomacy.stance,
      provenance: diplomacy.provenance ?? fallbackProvenance,
    }))

    const powerSystemRecords = powerTierSystems.map((system) => ({
      id: `power-system:${system.projectId}`,
      systemName: system.systemName,
      attributes: {
        projectId: system.projectId,
        systemName: system.systemName,
        tiers: [...system.tiers],
        specialModifiers: [...system.specialModifiers],
      },
      provenance: system.provenance ?? fallbackProvenance,
    }))

    const sceneRecords = sceneBeatPlans.map((plan) => ({
      id: `scene:${plan.id}`,
      title: `场景节拍：${plan.chapterId}`,
      documentId: plan.chapterId,
      blockIds: plan.beats.map((beat) => beat.id),
      entityIds: [],
      eventIds: [],
      summary: plan.beats.map((beat) => beat.title).join('；'),
      provenance: plan.provenance ?? fallbackProvenance,
    }))

    const constraintRecords = expectationContracts.map((contract) => ({
      id: `constraint:expectation:${contract.id}`,
      type: `expectation:${contract.status}`,
      description: contract.notes ? `${contract.title}：${contract.notes}` : contract.title,
      subjectIds: contract.chapterId ? [contract.chapterId] : [],
      severity: expectationConstraintSeverity(contract.status),
      provenance: contract.provenance ?? fallbackProvenance,
    }))

    // 3. 构建投影输入集合
    const sources: StoryPluginCollectionInput[] = [
      {
        sourceId: 'living-codex',
        collection: 'entities',
        records: codexRecords,
      },
      {
        sourceId: 'living-codex',
        collection: 'relations',
        records: codexRelations,
      },
      {
        sourceId: 'timeline-grid',
        collection: 'thread',
        records: threadRecords,
      },
      {
        sourceId: 'timeline-grid',
        collection: 'node',
        records: nodeRecords,
      },
      {
        sourceId: 'promise-ledger',
        collection: 'entry',
        records: promiseRecords,
      },
      {
        sourceId: 'multi-calendar',
        collection: 'calendar',
        records: calendarRecords,
      },
      {
        sourceId: 'multi-calendar',
        collection: 'chronology',
        records: chronologyRecords,
      },
      {
        sourceId: 'geography-map',
        collection: 'map',
        records: geoMapRecords,
      },
      {
        sourceId: 'faction-matrix',
        collection: 'diplomacy',
        records: diplomacyRecords,
      },
      {
        sourceId: 'power-system',
        collection: 'system',
        records: powerSystemRecords,
      },
      {
        sourceId: 'scene-beats',
        collection: 'plan',
        records: sceneRecords,
      },
      {
        sourceId: 'expectation-engine',
        collection: 'contract',
        records: constraintRecords,
      },
    ]

    // 4. 读取当前已存的 StoryState 获取当前 revision
    const existingState = await this.store.load(workspaceId)
    const currentRevision = existingState?.revision ?? 0
    const nextRevision = currentRevision + 1

    // 5. 投影生成新的 plugin 分区数据
    const projectedState = projectPluginRecordsToStoryState(sources, { revision: nextRevision })
    const legacyEntities = projectLegacyRecordsToStoryEntities([
      { sourceId: 'formData', records: formData },
      { sourceId: 'tableRows', records: tableRows },
      { sourceId: 'cardRecords', records: cardRecords },
    ])
    const legacyEntityMap = Object.fromEntries(legacyEntities.map((entity) => [entity.id, entity]))

    // 6. 分区物化保护（Partition Merging）：
    // 更新所有 canonical plugin 分区；scenes/constraints 仅替换本物化器拥有的命名空间，
    // 严格保留其他 StoryState 记录，避免破坏外部来源的数据。
    // 对 relations 进行分区清理：过滤掉旧有的 codex-rel:* 关系，防止已删除关系残留幽灵
    const preservedRelations = Object.fromEntries(
      Object.entries(existingState?.relations ?? {}).filter(([id]) => !id.startsWith('codex-rel:')),
    )
    const mergedRelations = {
      ...preservedRelations,
      ...projectedState.relations,
    }
    const preservedScenes = Object.fromEntries(
      Object.entries(existingState?.scenes ?? {}).filter(([id]) => !id.startsWith('scene:')),
    )
    const preservedConstraints = Object.fromEntries(
      Object.entries(existingState?.constraints ?? {}).filter(
        ([id]) => !id.startsWith('constraint:expectation:'),
      ),
    )

    const newState: StoryState = {
      revision: nextRevision,
      entities: { ...projectedState.entities, ...legacyEntityMap },
      relations: mergedRelations,
      events: projectedState.events,
      scenes: { ...preservedScenes, ...projectedState.scenes },
      timelines: projectedState.timelines,
      promises: projectedState.promises,
      constraints: { ...preservedConstraints, ...projectedState.constraints },
    }

    // 比较内容是否产生实质变化（忽略 revision 本身）
    if (existingState && isStateContentEqual(existingState, newState)) {
      this.sourceRevisions.set(workspaceId, latestWsRev)
      return existingState
    }

    // 7. 持久化权威 StoryState
    await this.store.save(workspaceId, newState)

    // 记录最新处理过的 workspace 变化版本（仅在成功持久化后更新 cursor，防止更新丢失）
    this.sourceRevisions.set(workspaceId, latestWsRev)

    // 8. 触发 StoryState 专用事件（解耦 Workspace 权威写入轴与 Materialized 读模型轴）
    storyStateEvents.publish(workspaceId, nextRevision)

    return newState
  }
}

export const storyStateMaterializer = new StoryStateMaterializer()

function expectationConstraintSeverity(
  status: ExpectationContract['status'],
): 'info' | 'warning' | 'error' {
  if (status === 'broken') return 'error'
  if (status === 'building' || status === 'climax') return 'warning'
  return 'info'
}

function isStateContentEqual(a: StoryState, b: StoryState): boolean {
  const cleanA = { ...a, revision: 0 }
  const cleanB = { ...b, revision: 0 }
  return serializeStoryState(cleanA) === serializeStoryState(cleanB)
}
