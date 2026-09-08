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
