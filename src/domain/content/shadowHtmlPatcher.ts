import type { TextPatch } from "../../ai/proposals/proposalLedger"
import {
  semanticDocumentFromHtml,
  type SemanticDocument,
} from "./semanticDocument"

/**
 * Applies semantic text patches to an HTML string using the source map of a SemanticDocument
 * without ever touching the live ProseMirror/TipTap editor DOM.
 *
 * Each patch is projected from its semantic range to editor/HTML character offsets.
 * Patches are applied from right to left (descending starting offset) so character
 * offsets earlier in the string remain invariant.
 */
export function applySemanticPatchesToHtml(
  html: string,
  patches: readonly TextPatch[],
  semanticDoc: SemanticDocument,
): { updatedHtml: string; inversePatches: TextPatch[] } {
  if (!patches || patches.length === 0) {
    return { updatedHtml: html, inversePatches: [] }
  }

  // Calculate inverse patches first based on original semantic document text
  const inversePatches: TextPatch[] = patches.map((patch) => ({
    documentId: patch.documentId ?? semanticDoc.documentId,
    from: patch.from,
    to: patch.from + patch.text.length,
    text: semanticDoc.text.slice(patch.from, patch.to),
  }))

  const isHtml = /<\s*[a-z][^>]*>/i.test(html)
  const mappingDoc =
    semanticDoc.representation === "html"
      ? semanticDoc
      : isHtml
        ? semanticDocumentFromHtml(semanticDoc.documentId, html, semanticDoc.revision)
        : semanticDoc

  // Patches are applied to string from right to left (descending by from offset)
  const sortedPatches = [...patches].sort((a, b) => b.from - a.from)
  let result = html

  for (const patch of sortedPatches) {
    const editorRange = mappingDoc.sourceMap.semanticRangeToEditor(patch.from, patch.to)
    const start = Math.max(0, Math.min(editorRange.from, result.length))
    const end = Math.max(start, Math.min(editorRange.to, result.length))

    result = result.slice(0, start) + patch.text + result.slice(end)
  }

  return { updatedHtml: result, inversePatches }
}
