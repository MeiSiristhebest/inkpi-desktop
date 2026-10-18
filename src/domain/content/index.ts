export {
  semanticDocumentFromHtml,
  semanticDocumentFromProseMirror,
  semanticDocumentFromText,
  type ProseMirrorNodeLike,
  type SemanticBlock,
  type SemanticDocument,
} from './semanticDocument'
export {
  projectContent,
  projectEditorContent,
  projectSemanticTextFields,
  semanticTextFromContent,
  type EditorContentInput,
} from './semanticProjection'
export { createBlockId } from './blockIdentity'
export { resolveSourceEvidenceRange, type SemanticRange } from './sourceReference'
export {
  createTextSourceMap,
  type EditorPosition,
  type SourceMapSegment,
  type TextSourceMap,
} from './sourceMap'
export { decodeHtmlEntities, normalizeHtmlText, normalizeText } from './textNormalizer'
export { applySemanticPatchesToHtml } from './shadowHtmlPatcher'
