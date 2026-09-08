import type { StoryState } from '../../domain/story'
import { isCanonicalFact } from '../../domain/story/provenance'

export interface StoryContextOptions {
  includeHypotheses?: boolean
  maxItems?: number
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
  const maxItems = options.maxItems === undefined ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(options.maxItems))
  const canonicalFacts = items.filter((item) => item.canonical).slice(0, maxItems)
  const hypotheses = items.filter((item) => !item.canonical).slice(0, maxItems)
  const grouped = (collection: string) => items.filter((item) => item.collection === collection)
  const context: Omit<StoryContext, 'fingerprint'> = {
    revision: state.revision,
    canonicalFacts,
    hypotheses: options.includeHypotheses === false ? [] : hypotheses,
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
      return [{
        id: `story:${story.revision}:${story.fingerprint}`,
        source: 'creative.story',
        kind: 'story-state',
        text: stableSerialize(story),
        data: story,
        priority: 800,
        relevance: 1,
        dependency: 1,
      }]
    },
  }
}

function toContextItem(collection: string, value: unknown): StoryContextItem {
  const record = value as Record<string, unknown>
  const provenance = (record.provenance || {}) as Record<string, unknown>
  const factLevel = String(provenance.factLevel || 'ai-inference')
  const confidence = typeof provenance.confidence === 'number' ? provenance.confidence : 0
  const label = String(record.name || record.title || record.label || record.id || collection)
  const summary = String(record.summary || record.description || record.statement || record.content || label)
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
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}
