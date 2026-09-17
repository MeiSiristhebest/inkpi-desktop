import type { StoryState } from '../../domain/story'
import { isCanonicalFact } from '../../domain/story/provenance'

export interface StoryContextOptions {
  includeHypotheses?: boolean
  maxItems?: number
  /**
   * 去重模式（默认开启）：
   * 当实体或事件已被 canonicalFacts 收录时，避免在 entities/events 中全量重复序列化，
   * 显著精简 Token 占用，避免注意力稀释。
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

  const items = collections.flatMap(([collection, values]) =>
    Object.values(values).map((value) => toContextItem(collection, value)),
  )

  const maxItems =
    options.maxItems === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Math.floor(options.maxItems))

  const filteredItems =
    options.includeHypotheses === false ? items.filter((item) => item.canonical) : items

  const canonicalFacts = filteredItems.filter((item) => item.canonical).slice(0, maxItems)
  const hypotheses =
    options.includeHypotheses === false
      ? []
      : filteredItems.filter((item) => !item.canonical).slice(0, maxItems)

  const canonicalIds = new Set(canonicalFacts.map((f) => f.id))

  // 去重逻辑：若某 collection 的项已被 canonicalFacts 收录，且开启了 deduplicate，
  // 则只保留其轻量引用或未收录的项，避免在最终 JSON 中重复出现
  const grouped = (collection: string) => {
    let list = filteredItems.filter((item) => item.collection === collection)
    if (deduplicate && (collection === 'entities' || collection === 'events')) {
      list = list.filter((item) => !canonicalIds.has(item.id))
    }
    // Task-aware 排序与过滤
    if (taskKind === 'creative.continue' || taskKind === 'creative.rewrite') {
      if (collection === 'promises') {
        list = list.filter((item) => item.summary && !item.summary.includes('fulfilled'))
      }
    }
    return list
  }

  const context: Omit<StoryContext, 'fingerprint'> = {
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
  return { ...context, fingerprint: hash(stableSerialize(context)) }
}

/** A ContextPipeline-compatible provider. It serializes story state only when a task asks for it. */
export function createStoryContextProvider(getState: () => StoryState | undefined) {
  return {
    id: 'creative.story',
    supports: ({ task }: { task: { contextPolicy?: { includeProjectState?: boolean } } }) =>
      task.contextPolicy?.includeProjectState === true,
    provide: ({ task }: { task: { contextPolicy?: { metadata?: Record<string, unknown> } } }) => {
      const story = compileStoryContext(getState(), {
        includeHypotheses: task.contextPolicy?.metadata?.includeHypotheses !== false,
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

function toContextItem(collection: string, value: unknown): StoryContextItem {
  const record = value as Record<string, unknown>
  const provenance = (record.provenance || {}) as Record<string, unknown>
  const factLevel = String(provenance.factLevel || 'ai-inference')
  const confidence = typeof provenance.confidence === 'number' ? provenance.confidence : 0
  const label = String(record.name || record.title || record.label || record.id || collection)
  const summary = String(
    record.summary || record.description || record.statement || record.content || label,
  )
  return {
    id: String(record.id),
    collection,
    label,
    summary,
    factLevel,
    confidence,
    canonical: isCanonicalFact({ ...provenance, factLevel } as never),
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? ''
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
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
