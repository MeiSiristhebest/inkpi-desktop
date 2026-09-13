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

const PROVENANCE_SOURCE_TYPES = new Set<ProvenanceSourceType>([
  'author',
  'editor',
  'ai-extracted',
  'ai-proposed',
  'derived',
])
const STORY_FACT_LEVELS = new Set<StoryFactLevel>([
  'canonical-fact',
  'character-belief',
  'rumor',
  'hypothesis',
  'ai-inference',
  'proposal',
])

export function createProvenance(input: ProvenanceInput): Provenance {
  if (!isPlainRecord(input)) throw new TypeError('Provenance input must be an object')
  const provenance = {
    ...input,
    ...(input.evidence === undefined
      ? {}
      : { evidence: input.evidence.map((item) => ({ ...item })) }),
  }
  assertProvenance(provenance)
  return provenance
}

export function assertProvenance(value: unknown, context = 'Provenance'): asserts value is Provenance {
  if (!isPlainRecord(value)) throw new Error(`${context} must be an object`)
  if (!PROVENANCE_SOURCE_TYPES.has(value.sourceType as ProvenanceSourceType)) {
    throw new Error(`${context} has an invalid sourceType`)
  }
  if (!STORY_FACT_LEVELS.has(value.factLevel as StoryFactLevel)) {
    throw new Error(`${context} has an invalid factLevel`)
  }
  assertOptionalString(value.sourceDocumentId, `${context}.sourceDocumentId`)
  assertOptionalString(value.sourceBlockId, `${context}.sourceBlockId`)
  assertOptionalString(value.createdBy, `${context}.createdBy`)
  const sourceRevision = value.sourceRevision
  if (
    sourceRevision !== undefined &&
    (typeof sourceRevision !== 'number' ||
      !Number.isSafeInteger(sourceRevision) ||
      sourceRevision < 0)
  ) {
    throw new Error(`${context} has an invalid sourceRevision`)
  }
  if (
    value.confidence !== undefined &&
    (typeof value.confidence !== 'number' ||
      !Number.isFinite(value.confidence) ||
      value.confidence < 0 ||
      value.confidence > 1)
  ) {
    throw new RangeError(`${context} confidence must be between 0 and 1`)
  }
  if (
    value.createdAt !== undefined &&
    (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt))
  ) {
    throw new Error(`${context} has an invalid createdAt`)
  }
  if (value.evidence === undefined) return
  if (!Array.isArray(value.evidence)) throw new Error(`${context}.evidence must be an array`)
  value.evidence.forEach((item, index) =>
    assertSourceEvidence(item, `${context}.evidence[${index}]`),
  )
}

function assertSourceEvidence(value: unknown, context: string): asserts value is SourceEvidence {
  if (!isPlainRecord(value)) throw new Error(`${context} must be an object`)
  assertOptionalString(value.documentId, `${context}.documentId`)
  assertOptionalString(value.blockId, `${context}.blockId`)
  assertOptionalString(value.excerpt, `${context}.excerpt`, false)
  const semanticFrom = value.semanticFrom
  if (
    semanticFrom !== undefined &&
    (typeof semanticFrom !== 'number' ||
      !Number.isSafeInteger(semanticFrom) ||
      semanticFrom < 0)
  ) {
    throw new Error(`${context} has an invalid semanticFrom`)
  }
  const semanticTo = value.semanticTo
  if (
    semanticTo !== undefined &&
    (typeof semanticTo !== 'number' ||
      !Number.isSafeInteger(semanticTo) ||
      semanticTo < 0)
  ) {
    throw new Error(`${context} has an invalid semanticTo`)
  }
  if (
    semanticFrom !== undefined &&
    semanticTo !== undefined &&
    semanticTo < semanticFrom
  ) {
    throw new Error(`${context} has a reversed semantic range`)
  }
}

function assertOptionalString(value: unknown, context: string, requireNonEmpty = true): void {
  if (value === undefined) return
  if (typeof value !== 'string' || (requireNonEmpty && value.trim() === '')) {
    throw new Error(`${context} must be a${requireNonEmpty ? ' non-empty' : ''} string`)
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function isCanonicalFact(provenance: Provenance): boolean {
  return provenance.factLevel === 'canonical-fact'
}
