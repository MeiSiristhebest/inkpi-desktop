import type { SemanticDocument } from '../../domain/content'
import type { StoryState } from '../../domain/story'
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
  projectRevision?: number
  budget?: ContextBudgetDistribution
  fingerprint: string
}

const CHARS_PER_TOKEN = 4

export function compileCreativeContext(input: CreativeContextInput): CreativeContext {
  const selection = normalizeRange(input.selection, input.document.text.length)
  const budget = input.totalTokenBudget
    ? calculateContextBudgetBuckets(input.totalTokenBudget)
    : undefined

  let text = input.document.text
  let selectionText = input.document.text.slice(selection.from, selection.to)

  // 预算保护：如果提供了 token 预算且正文长度超出 sceneTokens 限制，
  // 优先保留选区周围的上下文切片，防止超长文档将 StoryState/JIT 挤出上下文窗口
  if (budget) {
    const maxChars = budget.sceneTokens * CHARS_PER_TOKEN
    if (text.length > maxChars) {
      if (selectionText && selectionText.length <= maxChars) {
        const halfSurround = Math.floor((maxChars - selectionText.length) / 2)
        const start = Math.max(0, selection.from - halfSurround)
        const end = Math.min(text.length, selection.to + halfSurround)
        text = text.slice(start, end)
      } else if (selectionText && selectionText.length > maxChars) {
        selectionText = selectionText.slice(0, maxChars)
        text = selectionText
      } else {
        text = text.slice(Math.max(0, text.length - maxChars))
      }
    }
  }

  const context: Omit<CreativeContext, 'fingerprint'> = {
    documentId: input.document.documentId,
    revision: input.document.revision,
    text,
    selectionText,
    blocks: input.document.blocks.map(({ id, type, text, from, to }) => ({
      id,
      type,
      text,
      from,
      to,
    })),
    neighboringDocuments: (input.neighboringDocuments || []).map((document) => ({
      documentId: document.documentId,
      revision: document.revision,
      text: document.text,
    })),
    storyState: input.storyState,
    storyContext: compileStoryContext(input.storyState, {
      taskKind: input.taskKind,
      deduplicate: true,
      maxItems: budget ? Math.floor(budget.canonicalStoryTokens / 25) : undefined,
    }),
    projectRevision: input.projectRevision ?? input.document.revision,
    budget,
  }
  return { ...context, fingerprint: fingerprint(context) }
}

function normalizeRange(range: { from: number; to: number } | undefined, length: number) {
  const from = Math.max(0, Math.min(length, range?.from ?? 0))
  const to = Math.max(from, Math.min(length, range?.to ?? length))
  return { from, to }
}

function fingerprint(value: Omit<CreativeContext, 'fingerprint'>): string {
  const serialized = JSON.stringify(value) || ''
  let hash = 0x811c9dc5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
