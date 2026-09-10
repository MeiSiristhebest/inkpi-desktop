import type { SemanticDocument } from '../../domain/content'
import type { ContinuityFinding } from './taskResults'

export interface ContinuityDiagnosticLocation {
  blockId: string
  semanticFrom: number
  semanticTo: number
  editorFrom: number
  editorTo: number
}

export interface ContinuityDiagnosticMarker {
  findingId: string
  severity: ContinuityFinding['severity']
  description: string
  evidence?: string
  entityIds?: string[]
  blockIds?: string[]
  documentId: string
  revision: number
  locationStatus: 'located' | 'unlocated'
  unlocatedReason?: 'missing-block-evidence' | 'unknown-block'
  unresolvedBlockIds: string[]
  locations: ContinuityDiagnosticLocation[]
}

/**
 * Projects structured continuity findings onto the canonical document boundary.
 *
 * ContinuityFinding currently carries block ids, not character offsets. A
 * finding is therefore only anchored when those ids resolve in the audited
 * document; otherwise it remains visible in the audit panel without guessing a
 * gutter position.
 */
export function projectContinuityFindingsToEditor(
  document: SemanticDocument,
  findings: readonly ContinuityFinding[],
): ContinuityDiagnosticMarker[] {
  const blocksById = new Map(document.blocks.map((block) => [block.id, block]))

  return findings.map((finding) => {
    const blockIds = [...new Set(finding.blockIds ?? [])]
    const unresolvedBlockIds = blockIds.filter((blockId) => !blocksById.has(blockId))
    const locations = document.blocks
      .filter((block) => blockIds.includes(block.id))
      .map((block) => {
        const editorPosition = document.sourceMap.semanticRangeToEditor(block.from, block.to)
        return {
          blockId: block.id,
          semanticFrom: block.from,
          semanticTo: block.to,
          editorFrom: editorPosition.from,
          editorTo: editorPosition.to,
        }
      })

    return {
      findingId: finding.id,
      severity: finding.severity,
      description: finding.description,
      ...(finding.evidence === undefined ? {} : { evidence: finding.evidence }),
      ...(finding.entityIds === undefined ? {} : { entityIds: [...finding.entityIds] }),
      ...(finding.blockIds === undefined ? {} : { blockIds: [...finding.blockIds] }),
      documentId: document.documentId,
      revision: document.revision,
      locationStatus: locations.length > 0 ? 'located' : 'unlocated',
      ...(locations.length > 0
        ? {}
        : { unlocatedReason: blockIds.length === 0 ? 'missing-block-evidence' as const : 'unknown-block' as const }),
      unresolvedBlockIds,
      locations,
    }
  })
}
