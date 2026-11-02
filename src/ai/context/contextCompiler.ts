import type { SemanticDocument } from '../../domain/content'
import {
  type PreparedReferenceMaterials,
  type ReferenceMaterialOmissionReason,
} from '../../domain/references/referenceMaterials'
import { countStoryRecords, type StoryState } from '../../domain/story'
import type { DesktopPreparedContextCoverage } from '../../types/aiContextCoverage'
import { compileStoryContext, type StoryContext } from './storyContextCompiler'
import {
  calculateContextBudgetBuckets,
  type ContextBudgetDistribution,
} from './contextBudgetBuckets'

export interface CreativeContextInput {
  document: SemanticDocument
  selection?: { from: number; to: number }
  neighboringDocuments?: SemanticDocument[]
  storyState?: StoryState
  projectRevision?: number
  instruction?: string
  totalTokenBudget?: number
  taskKind?: string
  activeEntityIds?: string[]
  activePromiseIds?: string[]
  referenceMaterials?: PreparedReferenceMaterials
}

export interface CreativeContext {
  documentId: string
  revision: number
  text: string
  selectionText: string
  blocks: Array<{ id: string; type: string; text: string; from: number; to: number }>
  neighboringDocuments: Array<{ documentId: string; revision: number; text: string }>
  storyState?: StoryState
  storyContext?: StoryContext
  referenceMaterials?: PreparedReferenceMaterials
  projectRevision?: number
  budget?: ContextBudgetDistribution
  coverage: DesktopPreparedContextCoverage
  fingerprint: string
}

const CHARS_PER_TOKEN = 4

export function compileCreativeContext(input: CreativeContextInput): CreativeContext {
  const selection = normalizeRange(input.selection, input.document.text.length)
  const budget = input.totalTokenBudget
    ? calculateContextBudgetBuckets(
        input.totalTokenBudget,
        Boolean(input.referenceMaterials?.excerpts.length),
      )
    : undefined
  const referenceMaterials = input.referenceMaterials
    ? boundReferenceMaterials(
        input.referenceMaterials,
        budget ? budget.externalReferenceTokens * CHARS_PER_TOKEN : 4_000,
      )
    : undefined

  let text = input.document.text
  let textRangeStart = 0
  let selectionText = input.document.text.slice(selection.from, selection.to)
  const selectionSourceCharacters = selectionText.length

  // 预算保护：如果提供了 token 预算且正文长度超出 sceneTokens 限制，
  // 优先保留选区周围的上下文切片，防止超长文档将 StoryState/JIT 挤出上下文窗口
  if (budget) {
    const maxChars = budget.sceneTokens * CHARS_PER_TOKEN
    if (text.length > maxChars) {
      if (selectionText && selectionText.length <= maxChars) {
        const halfSurround = Math.floor((maxChars - selectionText.length) / 2)
        const start = Math.max(0, selection.from - halfSurround)
        const end = Math.min(text.length, selection.to + halfSurround)
        textRangeStart = start
        text = text.slice(start, end)
      } else if (selectionText && selectionText.length > maxChars) {
        selectionText = selectionText.slice(0, maxChars)
        textRangeStart = selection.from
        text = selectionText
      } else {
        textRangeStart = Math.max(0, text.length - maxChars)
        text = text.slice(textRangeStart)
      }
    }
  }

  const blocks = input.document.blocks.map(({ id, type, text, from, to }) => ({
    id,
    type,
    text,
    from,
    to,
  }))
  const neighboringDocuments = (input.neighboringDocuments || []).map((document) => ({
    documentId: document.documentId,
    revision: document.revision,
    text: document.text,
  }))
  const storyContext = compileStoryContext(input.storyState, {
    taskKind: input.taskKind,
    deduplicate: true,
    maxItems: budget ? Math.floor(budget.canonicalStoryTokens / 25) : undefined,
    maxCharacters: budget ? budget.canonicalStoryTokens * CHARS_PER_TOKEN : undefined,
    currentDocumentId: input.document.documentId,
    activeEntityIds: input.activeEntityIds,
    activePromiseIds: input.activePromiseIds,
  })
  const storyContextCollections = storyContext
    ? [
        storyContext.canonicalFacts,
        storyContext.hypotheses,
        storyContext.entities,
        storyContext.relations,
        storyContext.events,
        storyContext.scenes,
        storyContext.timelines,
        storyContext.promises,
        storyContext.constraints,
      ]
    : []
  const coverage: DesktopPreparedContextCoverage = {
    version: 1,
    documentText: {
      sourceCharacters: input.document.text.length,
      includedCharacters: text.length,
      rangeStart: textRangeStart,
      rangeEnd: textRangeStart + text.length,
    },
    selectionText: {
      explicitSelection: input.selection !== undefined,
      sourceCharacters: selectionSourceCharacters,
      includedCharacters: selectionText.length,
      rangeStart: selection.from,
      rangeEnd: selection.from + selectionText.length,
    },
    semanticBlocks: {
      count: blocks.length,
      characters: blocks.reduce((total, block) => total + block.text.length, 0),
    },
    neighboringDocuments: {
      count: neighboringDocuments.length,
      characters: neighboringDocuments.reduce((total, document) => total + document.text.length, 0),
    },
    storyState: {
      attached: input.storyState !== undefined,
      recordCount: countStoryRecords(input.storyState),
    },
    storyContext: {
      recordCount: storyContextCollections.reduce(
        (total, collection) => total + collection.length,
        0,
      ),
      canonicalFactCount: storyContext?.canonicalFacts.length ?? 0,
      hypothesisCount: storyContext?.hypotheses.length ?? 0,
    },
    jit: {
      entityCount: new Set(input.activeEntityIds ?? []).size,
      promiseCount: new Set(input.activePromiseIds ?? []).size,
    },
    ...(referenceMaterials ? { referenceMaterials: referenceMaterials.disclosure } : {}),
  }
  const context: Omit<CreativeContext, 'fingerprint'> = {
    documentId: input.document.documentId,
    revision: input.document.revision,
    text,
    selectionText,
    blocks,
    neighboringDocuments,
    storyState: input.storyState,
    storyContext,
    ...(referenceMaterials ? { referenceMaterials } : {}),
    projectRevision: input.projectRevision ?? input.document.revision,
    budget,
    coverage,
  }
  const { coverage: preparedCoverage, ...fingerprintInput } = context
  return {
    ...fingerprintInput,
    coverage: preparedCoverage,
    fingerprint: fingerprint(fingerprintInput),
  }
}

function boundReferenceMaterials(
  prepared: PreparedReferenceMaterials,
  maxCharacters: number,
): PreparedReferenceMaterials {
  let remaining = Math.max(0, Math.floor(maxCharacters))
  const excerpts = []
  const includedBySource = new Map<string, { passages: number; characters: number }>()
  const truncatedSources = new Set<string>()

  for (const excerpt of prepared.excerpts) {
    if (remaining <= 0) break
    let end = Math.min(excerpt.text.length, remaining)
    const last = excerpt.text.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) end -= 1
    const text = excerpt.text.slice(0, end)
    if (!text) continue
    const truncated = excerpt.truncated || text.length < excerpt.text.length
    excerpts.push({
      ...excerpt,
      end: excerpt.start + text.length,
      text,
      truncated,
    })
    if (truncated) truncatedSources.add(excerpt.sourceId)
    const previous = includedBySource.get(excerpt.sourceId) ?? { passages: 0, characters: 0 }
    includedBySource.set(excerpt.sourceId, {
      passages: previous.passages + 1,
      characters: previous.characters + text.length,
    })
    remaining -= text.length
  }

  const sources = prepared.disclosure.sources.map((source) => {
    const included = includedBySource.get(source.sourceId)
    let omissionReason: ReferenceMaterialOmissionReason | undefined
    if (!source.selected) omissionReason = 'not-selected'
    else if (source.matchedPassages === 0) omissionReason = 'no-matching-passages'
    else if (
      (included?.passages ?? 0) < source.matchedPassages ||
      truncatedSources.has(source.sourceId)
    ) {
      omissionReason = 'context-budget'
    }
    return {
      ...source,
      includedPassages: included?.passages ?? 0,
      includedCharacters: included?.characters ?? 0,
      ...(omissionReason ? { omissionReason } : { omissionReason: undefined }),
    }
  })
  return {
    excerpts,
    disclosure: {
      ...prepared.disclosure,
      selectedCount: sources.filter((source) => source.selected).length,
      includedCount: sources.filter((source) => source.includedPassages > 0).length,
      omittedCount: sources.filter((source) => source.omissionReason).length,
      includedCharacters: excerpts.reduce((total, excerpt) => total + excerpt.text.length, 0),
      sources,
    },
  }
}

function normalizeRange(range: { from: number; to: number } | undefined, length: number) {
  const from = Math.max(0, Math.min(length, range?.from ?? 0))
  const to = Math.max(from, Math.min(length, range?.to ?? length))
  return { from, to }
}

function fingerprint(value: Omit<CreativeContext, 'fingerprint' | 'coverage'>): string {
  const serialized = JSON.stringify(value) || ''
  let hash = 0x811c9dc5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
