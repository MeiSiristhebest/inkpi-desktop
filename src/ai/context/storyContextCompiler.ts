import type { StoryState } from '../../domain/story'
import { isCanonicalFact } from '../../domain/story/provenance'

export interface StoryContextOptions {
  includeHypotheses?: boolean
  maxItems?: number
  /** Entity IDs matched in the active document or expanded through a relation. */
  activeEntityIds?: string[]
  /** Open promises matched to the active document. */
  activePromiseIds?: string[]
  /** The current chapter, used to include its scene and linked records. */
  currentDocumentId?: string
  /** Approximate serialized character budget for the projected story context. */
  maxCharacters?: number
  /**
   * 去重模式：当某一项已被 canonicalFacts 收录时，不再在它的原集合里重复序列化。
   * 默认只在 taskKind 存在时开启（调用方明确表达了任务意图，才认为精简是安全的）。
   */
  deduplicate?: boolean
  /**
   * 针对不同任务类型的定制化裁剪（task-aware projection）：
   * - 'creative.continue' / 'creative.rewrite': 优先正典实体、人物关系与未完伏笔
   * - 'narrative.continuity.audit': 突出世界观约束 (constraints)、时间线与全量伏笔
   * - 'narrative.project.distill': 突出既有事实，辅助查漏补缺
   */
  taskKind?: string
}

export interface StoryContextItem {
  id: string
  collection: string
  label: string
  summary: string
  factLevel: string
  confidence: number
  canonical: boolean
  /** Carried through so task-aware projections can filter on lifecycle state, not on prose. */
  status?: string
  /** Domain fields needed to interpret the record without sending the full project state. */
  details?: Record<string, unknown>
  provenance?: StoryContextProvenance
}

export interface StoryContextProvenance {
  sourceType?: string
  sourceDocumentId?: string
  sourceBlockId?: string
  sourceRevision?: number
  evidence?: StoryContextEvidence[]
}

export interface StoryContextEvidence {
  documentId?: string
  blockId?: string
  excerpt?: string
  semanticFrom?: number
  semanticTo?: number
}

export interface StoryContext {
  revision: number
  canonicalFacts: StoryContextItem[]
  hypotheses: StoryContextItem[]
  entities: StoryContextItem[]
  relations: StoryContextItem[]
  events: StoryContextItem[]
  scenes: StoryContextItem[]
  timelines: StoryContextItem[]
  promises: StoryContextItem[]
  constraints: StoryContextItem[]
  fingerprint: string
}

export function compileStoryContext(
  state: StoryState | undefined,
  options: StoryContextOptions = {},
): StoryContext | undefined {
  if (!state) return undefined
  const deduplicate = options.deduplicate ?? options.taskKind !== undefined
  const taskKind = options.taskKind

  const collections = [
    ['entities', state.entities],
    ['relations', state.relations],
    ['events', state.events],
    ['scenes', state.scenes],
    ['timelines', state.timelines],
    ['promises', state.promises],
    ['constraints', state.constraints],
  ] as const

  const entityLabels = new Map(
    Object.values(state.entities).map((entity) => [entity.id, entity.name] as const),
  )
  const candidates = collections.flatMap(([collection, values]) =>
    Object.values(values).map((value) => toContextCandidate(collection, value, entityLabels)),
  )

  const activeEntityIds =
    options.activeEntityIds === undefined ? undefined : new Set(options.activeEntityIds)
  const activePromiseIds =
    options.activePromiseIds === undefined ? undefined : new Set(options.activePromiseIds)
  const currentDocumentScenes = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.item.collection === 'scenes' &&
          candidate.documentIds.includes(options.currentDocumentId ?? ''),
      )
      .map((candidate) => candidate.item.id),
  )
  const chapterEntityIds = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.item.collection === 'scenes' &&
          candidate.documentIds.includes(options.currentDocumentId ?? ''),
      )
      .flatMap((candidate) => candidate.entityIds),
  )
  const relevantEntities =
    activeEntityIds === undefined ? undefined : new Set([...activeEntityIds, ...chapterEntityIds])
  const currentSceneEventIds = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.item.collection === 'scenes' && currentDocumentScenes.has(candidate.item.id),
      )
      .flatMap((candidate) => candidate.eventIds),
  )
  const relevantEventIds = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.item.collection === 'events' &&
          (candidate.entityIds.some((id) => relevantEntities?.has(id)) ||
            candidate.sceneIds.some((id) => currentDocumentScenes.has(id)) ||
            currentSceneEventIds.has(candidate.item.id)),
      )
      .map((candidate) => candidate.item.id),
  )

  const relevantCandidates =
    relevantEntities === undefined
      ? candidates
      : candidates.filter((candidate) =>
          isRelevantCandidate(candidate, {
            activeEntityIds: relevantEntities,
            activePromiseIds,
            currentDocumentId: options.currentDocumentId,
            currentDocumentScenes,
            relevantEventIds,
          }),
        )

  const maxItems =
    options.maxItems === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Math.floor(options.maxItems))

  const buildContext = (selected: typeof candidates): Omit<StoryContext, 'fingerprint'> => {
    const items = selected.map((candidate) => candidate.item)
    const filteredItems =
      options.includeHypotheses === false ? items.filter((item) => item.canonical) : items

    const canonicalFacts = filteredItems.filter((item) => item.canonical).slice(0, maxItems)
    const hypotheses =
      options.includeHypotheses === false
        ? []
        : filteredItems.filter((item) => !item.canonical).slice(0, maxItems)

    // 去重按 collection + id 组合键判定：不同集合可能共用同一个 id。
    const canonicalKeys = new Set(canonicalFacts.map((item) => `${item.collection}:${item.id}`))

    const grouped = (collection: string) => {
      let list = filteredItems.filter((item) => item.collection === collection)
      if (deduplicate) {
        list = list.filter((item) => !canonicalKeys.has(`${collection}:${item.id}`))
      }
      if (
        (taskKind === 'creative.continue' || taskKind === 'creative.rewrite') &&
        collection === 'promises'
      ) {
        // 续写/改写只需要未兑现的伏笔；已兑现与已废弃的属于结局信息，不该再驱动生成。
        list = list.filter((item) => item.status !== 'fulfilled' && item.status !== 'abandoned')
      }
      return list
    }

    return {
      revision: state.revision,
      canonicalFacts,
      hypotheses,
      entities: grouped('entities'),
      relations: grouped('relations'),
      events: grouped('events'),
      scenes: grouped('scenes'),
      timelines: grouped('timelines'),
      promises: grouped('promises'),
      constraints: grouped('constraints'),
    }
  }

  let selected = relevantCandidates
  if (options.maxCharacters !== undefined) {
    const maxCharacters = Math.max(0, Math.floor(options.maxCharacters))
    const ordered = [...relevantCandidates].sort(
      (left, right) =>
        candidatePriority(right, options.currentDocumentId, relevantEntities) -
        candidatePriority(left, options.currentDocumentId, relevantEntities),
    )
    selected = []
    for (const candidate of ordered) {
      const proposed = [...selected, candidate]
      // Reserve room for the fingerprint added below.
      if (stableSerialize(buildContext(proposed)).length + 32 <= maxCharacters) {
        selected = proposed
      }
    }
  }

  const context = buildContext(selected)
  return { ...context, fingerprint: hash(stableSerialize(context)) }
}

/** A ContextPipeline-compatible provider. It serializes story state only when a task asks for it. */
export function createStoryContextProvider(getState: () => StoryState | undefined) {
  return {
    id: 'creative.story',
    supports: ({ task }: { task: { contextPolicy?: { includeProjectState?: boolean } } }) =>
      task.contextPolicy?.includeProjectState === true,
    provide: ({
      task,
    }: {
      task: {
        kind?: string
        contextPolicy?: { metadata?: Record<string, unknown> }
      }
    }) => {
      const story = compileStoryContext(getState(), {
        includeHypotheses: task.contextPolicy?.metadata?.includeHypotheses !== false,
        // 任务身份决定投影方式，必须一路带到编译器；否则 taskKind/deduplicate 永远是死选项。
        ...(typeof task.kind === 'string' && task.kind ? { taskKind: task.kind } : {}),
      })
      if (!story) return []
      return [
        {
          id: `story:${story.revision}:${story.fingerprint}`,
          source: 'creative.story',
          kind: 'story-state',
          text: stableSerialize(story),
          data: story,
          priority: 800,
          relevance: 1,
          dependency: 1,
        },
      ]
    },
  }
}

interface StoryContextCandidate {
  item: StoryContextItem
  entityIds: string[]
  eventIds: string[]
  sceneIds: string[]
  documentIds: string[]
}

function toContextCandidate(
  collection: string,
  value: unknown,
  entityLabels: Map<string, string>,
): StoryContextCandidate {
  const record = value as Record<string, unknown>
  const provenance = (record.provenance || {}) as Record<string, unknown>
  const factLevel = String(provenance.factLevel || 'ai-inference')
  const confidence = typeof provenance.confidence === 'number' ? provenance.confidence : 0
  const label =
    firstText(record.name, record.title, record.label) ??
    derivedLabel(collection, record, entityLabels) ??
    String(record.id || collection)
  const baseSummary =
    firstText(record.summary, record.description, record.statement, record.content) ??
    derivedSummary(collection, record, entityLabels) ??
    label
  const legacyDetails = legacyDataSummary(record)
  const summary = clipText(legacyDetails ? `${baseSummary}；${legacyDetails}` : baseSummary, 600)
  const details = detailsFor(collection, record, entityLabels)
  const evidence = projectEvidence(provenance.evidence ?? record.evidence)
  const itemProvenance = projectProvenance(provenance, evidence)
  const item: StoryContextItem = {
    id: String(record.id),
    collection,
    label: clipText(label, 160),
    summary,
    factLevel,
    confidence,
    canonical: isCanonicalFact({ ...provenance, factLevel } as never),
    ...(typeof record.status === 'string' ? { status: record.status } : {}),
    ...(details ? { details } : {}),
    ...(itemProvenance ? { provenance: itemProvenance } : {}),
  }

  return {
    item,
    entityIds: referencedIds(collection, record, 'entityIds'),
    eventIds: referencedIds(collection, record, 'eventIds'),
    sceneIds: referencedIds(collection, record, 'sceneIds'),
    documentIds: [
      record.documentId,
      ...referencedStrings(provenance.evidence ?? record.evidence, 'documentId'),
    ].filter((id): id is string => typeof id === 'string'),
  }
}

function isRelevantCandidate(
  candidate: StoryContextCandidate,
  scope: {
    activeEntityIds: Set<string>
    activePromiseIds?: Set<string>
    currentDocumentId?: string
    currentDocumentScenes: Set<string>
    relevantEventIds: Set<string>
  },
): boolean {
  const overlapsActiveEntity = candidate.entityIds.some((id) => scope.activeEntityIds.has(id))
  switch (candidate.item.collection) {
    case 'entities':
      return scope.activeEntityIds.has(candidate.item.id)
    case 'relations':
      return overlapsActiveEntity
    case 'events':
      return (
        overlapsActiveEntity || candidate.sceneIds.some((id) => scope.currentDocumentScenes.has(id))
      )
    case 'scenes':
      return (
        candidate.documentIds.includes(scope.currentDocumentId ?? '') ||
        overlapsActiveEntity ||
        candidate.eventIds.some((id) => scope.relevantEventIds.has(id))
      )
    case 'timelines':
      return candidate.eventIds.some((id) => scope.relevantEventIds.has(id))
    case 'promises':
      return Boolean(scope.activePromiseIds?.has(candidate.item.id)) || overlapsActiveEntity
    case 'constraints':
      return candidate.entityIds.length === 0 || overlapsActiveEntity
    default:
      return false
  }
}

function candidatePriority(
  candidate: StoryContextCandidate,
  currentDocumentId: string | undefined,
  activeEntityIds: Set<string> | undefined,
): number {
  const activeReference = candidate.entityIds.some((id) => activeEntityIds?.has(id))
  if (candidate.item.collection === 'entities' && activeEntityIds?.has(candidate.item.id))
    return 100
  if (candidate.item.collection === 'relations' && activeReference) return 90
  if (candidate.item.collection === 'constraints' && activeReference) return 85
  if (candidate.item.collection === 'promises') return 80
  if (
    candidate.item.collection === 'scenes' &&
    candidate.documentIds.includes(currentDocumentId ?? '')
  )
    return 75
  if (candidate.item.collection === 'events' && activeReference) return 70
  if (candidate.item.collection === 'timelines') return 60
  if (candidate.item.collection === 'constraints') return 55
  if (candidate.item.collection === 'events' || candidate.item.collection === 'scenes') return 50
  return 40
}

function detailsFor(
  collection: string,
  record: Record<string, unknown>,
  entityLabels: Map<string, string>,
): Record<string, unknown> | undefined {
  const attributes = projectAttributes(record.attributes)
  let details: Record<string, unknown>
  switch (collection) {
    case 'entities':
      details = {
        kind: record.kind,
        aliases: projectStrings(record.aliases),
        attributes,
      }
      break
    case 'relations':
      details = {
        type: record.type,
        source: labeledId(record.sourceEntityId, entityLabels),
        target: labeledId(record.targetEntityId, entityLabels),
        attributes,
      }
      break
    case 'events':
      details = {
        type: record.type,
        occurredAt: record.occurredAt,
        sceneId: record.sceneId,
        entities: projectReferences(record.entityIds, entityLabels),
        attributes,
      }
      break
    case 'scenes':
      details = {
        documentId: record.documentId,
        order: record.order,
        blockIds: projectStrings(record.blockIds),
        entities: projectReferences(record.entityIds, entityLabels),
        eventIds: projectStrings(record.eventIds),
      }
      break
    case 'timelines':
      details = {
        eventIds: projectStrings(record.eventIds),
        constraints: projectTimelineConstraints(record.constraints),
      }
      break
    case 'promises':
      details = {
        introducedAt: record.introducedAt,
        resolvedAt: record.resolvedAt,
        relatedEntities: projectReferences(record.relatedEntityIds, entityLabels),
      }
      break
    case 'constraints':
      details = {
        type: record.type,
        severity: record.severity,
        subjects: projectReferences(record.subjectIds, entityLabels),
      }
      break
    default:
      details = { attributes }
  }
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined))
}

function derivedLabel(
  collection: string,
  record: Record<string, unknown>,
  entityLabels: Map<string, string>,
): string | undefined {
  if (collection === 'relations') {
    const source =
      entityLabels.get(String(record.sourceEntityId)) ?? String(record.sourceEntityId ?? '')
    const target =
      entityLabels.get(String(record.targetEntityId)) ?? String(record.targetEntityId ?? '')
    if (source || target) return `${source} —${String(record.type ?? '关系')}→ ${target}`
  }
  return firstText(record.type, record.kind)
}

function derivedSummary(
  collection: string,
  record: Record<string, unknown>,
  entityLabels: Map<string, string>,
): string | undefined {
  if (collection === 'events') {
    const entities = referencedIds(collection, record, 'entityIds')
      .map((id) => entityLabels.get(id) ?? id)
      .join('、')
    return entities ? `${String(record.type ?? '事件')}：${entities}` : firstText(record.type)
  }
  return collection === 'relations' ? derivedLabel(collection, record, entityLabels) : undefined
}

function projectAttributes(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const attributes: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record).slice(0, 12)) {
    const projected = projectJsonValue(item)
    if (projected !== undefined) attributes[clipText(key, 80)] = projected
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined
}

function projectJsonValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return clipText(value.trim(), 240)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) {
    if (depth >= 2) return undefined
    const values = value.slice(0, 8).flatMap((item) => {
      const projected = projectJsonValue(item, depth + 1)
      return projected === undefined ? [] : [projected]
    })
    return values.length > 0 ? values : undefined
  }
  const record = asRecord(value)
  if (!record || depth >= 2) return undefined
  const entries = Object.entries(record)
    .slice(0, 8)
    .flatMap(([key, item]) => {
      const projected = projectJsonValue(item, depth + 1)
      return projected === undefined ? [] : [[clipText(key, 80), projected] as const]
    })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function projectProvenance(
  provenance: Record<string, unknown>,
  evidence: StoryContextEvidence[] | undefined,
): StoryContextProvenance | undefined {
  const result = Object.fromEntries(
    Object.entries({
      sourceType: typeof provenance.sourceType === 'string' ? provenance.sourceType : undefined,
      sourceDocumentId:
        typeof provenance.sourceDocumentId === 'string' ? provenance.sourceDocumentId : undefined,
      sourceBlockId:
        typeof provenance.sourceBlockId === 'string' ? provenance.sourceBlockId : undefined,
      sourceRevision:
        typeof provenance.sourceRevision === 'number' ? provenance.sourceRevision : undefined,
      evidence,
    }).filter(([, value]) => value !== undefined),
  ) as StoryContextProvenance
  return Object.values(result).some((value) => value !== undefined) ? result : undefined
}

function projectEvidence(value: unknown): StoryContextEvidence[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 4).flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const evidence = Object.fromEntries(
      Object.entries({
        documentId: typeof record.documentId === 'string' ? record.documentId : undefined,
        blockId: typeof record.blockId === 'string' ? record.blockId : undefined,
        excerpt: typeof record.excerpt === 'string' ? clipText(record.excerpt, 360) : undefined,
        semanticFrom: typeof record.semanticFrom === 'number' ? record.semanticFrom : undefined,
        semanticTo: typeof record.semanticTo === 'number' ? record.semanticTo : undefined,
      }).filter(([, itemValue]) => itemValue !== undefined),
    ) as StoryContextEvidence
    return Object.values(evidence).some((value) => value !== undefined) ? [evidence] : []
  })
}

function referencedIds(
  collection: string,
  record: Record<string, unknown>,
  kind: 'entityIds' | 'eventIds' | 'sceneIds',
): string[] {
  const value =
    collection === 'relations'
      ? [record.sourceEntityId, record.targetEntityId]
      : collection === 'constraints'
        ? record.subjectIds
        : collection === 'promises' && kind === 'entityIds'
          ? record.relatedEntityIds
          : record[kind]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function referencedStrings(value: unknown, key: string): Array<string | undefined> {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item)?.[key])
        .filter((item): item is string => typeof item === 'string')
    : []
}

function projectStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string').slice(0, 12)
  return strings.length > 0 ? strings : undefined
}

function projectReferences(
  value: unknown,
  entityLabels: Map<string, string>,
): Array<{ id: string; label: string }> | undefined {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 12)
    : []
  return ids.length > 0 ? ids.map((id) => ({ id, label: entityLabels.get(id) ?? id })) : undefined
}

function labeledId(
  value: unknown,
  entityLabels: Map<string, string>,
): { id: string; label: string } | undefined {
  if (typeof value !== 'string') return undefined
  return { id: value, label: entityLabels.get(value) ?? value }
}

function projectTimelineConstraints(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined
  const constraints = value.slice(0, 8).flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const projected = {
      type: typeof record.type === 'string' ? record.type : undefined,
      description:
        typeof record.description === 'string' ? clipText(record.description, 240) : undefined,
      eventIds: projectStrings(record.eventIds),
    }
    return Object.values(projected).some((entry) => entry !== undefined) ? [projected] : []
  })
  return constraints.length > 0 ? constraints : undefined
}

function firstText(...values: unknown[]): string | undefined {
  return values
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim()
}

function clipText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`
}

function legacyDataSummary(record: Record<string, unknown>): string | undefined {
  const attributes = asRecord(record.attributes)
  const data = asRecord(attributes?.data)
  if (typeof attributes?.legacySource !== 'string' || !data) return undefined

  const fields = Object.entries(data).flatMap(([key, value]) => {
    const field = key.trim()
    const content = legacyValueText(value)
    return field && content ? [`${field}：${content}`] : []
  })
  return fields.length > 0 ? fields.join('；') : undefined
}

function legacyValueText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => {
      const text = legacyValueText(item)
      return text ? [text] : []
    })
    return items.length > 0 ? items.join('、') : undefined
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? ''
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}
