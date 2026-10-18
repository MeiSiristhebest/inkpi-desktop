import {
  semanticDocumentFromHtml,
  semanticDocumentFromProseMirror,
  semanticDocumentFromText,
  type ProseMirrorNodeLike,
  type SemanticDocument,
} from './semanticDocument'

export interface EditorContentInput {
  documentId: string
  revision?: number
  json?: ProseMirrorNodeLike
  html?: string
  text?: string
}

const STRUCTURAL_TEXT_FIELDS = new Set([
  'id',
  'ids',
  'projectId',
  'workspaceId',
  'chapterId',
  'chapterIds',
  'volumeId',
  'threadId',
  'nodeId',
  'eventId',
  'clueId',
  'characterId',
  'entityId',
  'documentId',
  'blockId',
  'parentId',
  'targetId',
  'promiseId',
  'constraintId',
  'artifactId',
  'taskId',
  'requestId',
  'conversationId',
  'sessionId',
  'sourceId',
  'sourceIds',
  'sourceDocumentId',
  'sourceBlockId',
  'relatedEntityIds',
  'characterIds',
  'prerequisites',
  'nextEventIds',
  'violatedConstraintIds',
])

export function projectEditorContent(input: EditorContentInput): SemanticDocument {
  const revision = input.revision ?? 0
  if (input.json !== undefined) {
    return semanticDocumentFromProseMirror(input.documentId, input.json, revision)
  }
  if (input.html !== undefined) {
    return semanticDocumentFromHtml(input.documentId, input.html, revision)
  }
  return semanticDocumentFromText(input.documentId, input.text ?? '', revision)
}

export function projectContent(
  documentId: string,
  content: string | ProseMirrorNodeLike,
  revision = 0,
): SemanticDocument {
  if (typeof content !== 'string') {
    return semanticDocumentFromProseMirror(documentId, content, revision)
  }
  return /<\s*[a-z][^>]*>/i.test(content)
    ? semanticDocumentFromHtml(documentId, content, revision)
    : semanticDocumentFromText(documentId, content, revision)
}

export function semanticTextFromContent(
  documentId: string,
  content: string | ProseMirrorNodeLike,
  revision = 0,
): string {
  return projectContent(documentId, content, revision).text
}

/** Removes editor markup from nested prose fields while preserving structural identifiers. */
export function projectSemanticTextFields(input: unknown): unknown {
  const project = (value: unknown, field: string, path: string): unknown => {
    if (STRUCTURAL_TEXT_FIELDS.has(field) || /(?:Id|Ids)$/.test(field)) return value
    if (typeof value === 'string') {
      return /<\s*[a-z][^>]*>/i.test(value)
        ? semanticTextFromContent(`semantic-field:${path}`, value)
        : value
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => project(item, field, `${path}.${index}`))
    }
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, project(child, key, `${path}.${key}`)]),
      )
    }
    return value
  }

  return project(input, 'input', 'input')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
