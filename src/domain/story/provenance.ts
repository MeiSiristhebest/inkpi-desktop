export type StoryFactLevel =
  'canonical-fact' | 'character-belief' | 'rumor' | 'hypothesis' | 'ai-inference' | 'proposal'

export type ProvenanceSourceType = 'author' | 'editor' | 'ai-extracted' | 'ai-proposed' | 'derived'

export interface SourceEvidence {
  documentId?: string
  blockId?: string
  excerpt?: string
  semanticFrom?: number
  semanticTo?: number
}

export interface Provenance {
  sourceType: ProvenanceSourceType
  factLevel: StoryFactLevel
  sourceDocumentId?: string
  sourceBlockId?: string
  sourceRevision?: number
  confidence?: number
  evidence?: SourceEvidence[]
  createdAt?: number
  createdBy?: string
}

export type ProvenanceInput = Omit<Provenance, 'evidence'> & {
  evidence?: SourceEvidence[]
}

export function createProvenance(input: ProvenanceInput): Provenance {
  const confidence = input.confidence
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
    throw new RangeError('Provenance confidence must be between 0 and 1')
  }
  return {
    ...input,
    evidence: input.evidence?.map((item) => ({ ...item })),
  }
}

export function isCanonicalFact(provenance: Provenance): boolean {
  return provenance.factLevel === 'canonical-fact'
}
