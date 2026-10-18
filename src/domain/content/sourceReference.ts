import type { SourceEvidence } from '../story/provenance'
import type { SemanticDocument } from './semanticDocument'

export interface SemanticRange {
  from: number
  to: number
}

function validRange(document: SemanticDocument, from: number, to: number): boolean {
  return (
    Number.isSafeInteger(from) &&
    Number.isSafeInteger(to) &&
    from >= 0 &&
    from < to &&
    to <= document.text.length
  )
}

function uniqueExcerptRange(document: SemanticDocument, excerpt: string): SemanticRange | null {
  const first = document.text.indexOf(excerpt)
  if (first < 0 || document.text.indexOf(excerpt, first + 1) >= 0) return null
  return { from: first, to: first + excerpt.length }
}

/** Locate verified source text without applying old offsets to a changed document. */
export function resolveSourceEvidenceRange(
  document: SemanticDocument,
  evidence: SourceEvidence,
  sourceRevisionMatches: boolean,
): SemanticRange | null {
  if (evidence.documentId && evidence.documentId !== document.documentId) return null

  const hasRange =
    typeof evidence.semanticFrom === 'number' &&
    typeof evidence.semanticTo === 'number' &&
    validRange(document, evidence.semanticFrom, evidence.semanticTo)
  const excerpt = evidence.excerpt?.trim()

  if (excerpt) {
    if (
      sourceRevisionMatches &&
      hasRange &&
      document.text.slice(evidence.semanticFrom, evidence.semanticTo) === excerpt
    ) {
      return { from: evidence.semanticFrom!, to: evidence.semanticTo! }
    }
    return uniqueExcerptRange(document, excerpt)
  }

  if (sourceRevisionMatches && hasRange) {
    return { from: evidence.semanticFrom!, to: evidence.semanticTo! }
  }

  if (sourceRevisionMatches && evidence.blockId) {
    const block = document.blocks.find((candidate) => candidate.id === evidence.blockId)
    if (block && block.from < block.to) return { from: block.from, to: block.to }
  }

  return null
}
