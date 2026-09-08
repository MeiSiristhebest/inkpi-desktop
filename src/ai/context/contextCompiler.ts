import type { SemanticDocument } from '../../domain/content'
import type { StoryState } from '../../domain/story'
import { compileStoryContext, type StoryContext } from './storyContextCompiler'

export interface CreativeContextInput {
  document: SemanticDocument
  selection?: { from: number; to: number }
  neighboringDocuments?: SemanticDocument[]
  storyState?: StoryState
  projectRevision?: number
  instruction?: string
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
  fingerprint: string
}

export function compileCreativeContext(input: CreativeContextInput): CreativeContext {
  const selection = normalizeRange(input.selection, input.document.text.length)
  const context: Omit<CreativeContext, 'fingerprint'> = {
    documentId: input.document.documentId,
    revision: input.document.revision,
    text: input.document.text,
    selectionText: input.document.text.slice(selection.from, selection.to),
    blocks: input.document.blocks.map(({ id, type, text, from, to }) => ({ id, type, text, from, to })),
    neighboringDocuments: (input.neighboringDocuments || []).map((document) => ({
      documentId: document.documentId,
      revision: document.revision,
      text: document.text,
    })),
    storyState: input.storyState,
    storyContext: compileStoryContext(input.storyState),
    projectRevision: input.projectRevision ?? input.document.revision,
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
