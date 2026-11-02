import type {
  ReferenceMaterialOmissionReason,
  ReferenceSourceDisclosure,
} from '../domain/references/referenceMaterials'

const DESKTOP_CONTEXT_TASK_KINDS = new Set([
  'creative.assistant',
  'creative.continue',
  'creative.rewrite',
  'narrative.continuity.audit',
  'narrative.deep.reason',
  'narrative.project.distill',
])

export interface DesktopPreparedContextCoverage {
  version: 1
  documentText: {
    sourceCharacters: number
    includedCharacters: number
    rangeStart: number
    rangeEnd: number
  }
  selectionText: {
    explicitSelection: boolean
    sourceCharacters: number
    includedCharacters: number
    rangeStart: number
    rangeEnd: number
  }
  semanticBlocks: { count: number; characters: number }
  neighboringDocuments: { count: number; characters: number }
  storyState: { attached: boolean; recordCount: number }
  storyContext: { recordCount: number; canonicalFactCount: number; hypothesisCount: number }
  jit: { entityCount: number; promiseCount: number }
  referenceMaterials?: {
    sourceCount: number
    selectedCount: number
    includedCount: number
    omittedCount: number
    includedCharacters: number
    sources: ReferenceSourceDisclosure[]
  }
}

/** Accept the summary only on built-in creative task kinds, not arbitrary plugin metadata. */
export function readDesktopPreparedContextCoverageForTask(
  taskKind: string,
  value: unknown,
): DesktopPreparedContextCoverage | undefined {
  if (!DESKTOP_CONTEXT_TASK_KINDS.has(taskKind)) return undefined
  return readDesktopPreparedContextCoverage(value)
}

/** Read the small, content-free coverage summary persisted with a Desktop result. */
export function readDesktopPreparedContextCoverage(
  value: unknown,
): DesktopPreparedContextCoverage | undefined {
  const record = asRecord(value)
  const documentText = asRecord(record?.documentText)
  const selectionText = asRecord(record?.selectionText)
  const semanticBlocks = asRecord(record?.semanticBlocks)
  const neighboringDocuments = asRecord(record?.neighboringDocuments)
  const storyState = asRecord(record?.storyState)
  const storyContext = asRecord(record?.storyContext)
  const jit = asRecord(record?.jit)
  const referenceMaterials =
    record?.referenceMaterials === undefined
      ? undefined
      : readReferenceMaterialsCoverage(record.referenceMaterials)
  if (
    record?.version !== 1 ||
    (record.referenceMaterials !== undefined && !referenceMaterials) ||
    !documentText ||
    !selectionText ||
    !semanticBlocks ||
    !neighboringDocuments ||
    !storyState ||
    !storyContext ||
    !jit
  ) {
    return undefined
  }

  const documentSource = readCount(documentText.sourceCharacters)
  const documentIncluded = readCount(documentText.includedCharacters)
  const documentRangeStart = readCount(documentText.rangeStart)
  const documentRangeEnd = readCount(documentText.rangeEnd)
  const selectionSource = readCount(selectionText.sourceCharacters)
  const selectionIncluded = readCount(selectionText.includedCharacters)
  const selectionRangeStart = readCount(selectionText.rangeStart)
  const selectionRangeEnd = readCount(selectionText.rangeEnd)
  const blockCount = readCount(semanticBlocks.count)
  const blockCharacters = readCount(semanticBlocks.characters)
  const neighboringCount = readCount(neighboringDocuments.count)
  const neighboringCharacters = readCount(neighboringDocuments.characters)
  const storyRecordCount = readCount(storyState.recordCount)
  const storyContextRecordCount = readCount(storyContext.recordCount)
  const canonicalFactCount = readCount(storyContext.canonicalFactCount)
  const hypothesisCount = readCount(storyContext.hypothesisCount)
  const entityCount = readCount(jit.entityCount)
  const promiseCount = readCount(jit.promiseCount)

  if (
    typeof selectionText.explicitSelection !== 'boolean' ||
    typeof storyState.attached !== 'boolean' ||
    documentSource === undefined ||
    documentIncluded === undefined ||
    documentRangeStart === undefined ||
    documentRangeEnd === undefined ||
    selectionSource === undefined ||
    selectionIncluded === undefined ||
    selectionRangeStart === undefined ||
    selectionRangeEnd === undefined ||
    blockCount === undefined ||
    blockCharacters === undefined ||
    neighboringCount === undefined ||
    neighboringCharacters === undefined ||
    storyRecordCount === undefined ||
    storyContextRecordCount === undefined ||
    canonicalFactCount === undefined ||
    hypothesisCount === undefined ||
    entityCount === undefined ||
    promiseCount === undefined
  ) {
    return undefined
  }

  if (
    documentIncluded > documentSource ||
    documentRangeStart > documentRangeEnd ||
    documentRangeEnd > documentSource ||
    documentRangeEnd - documentRangeStart !== documentIncluded ||
    selectionIncluded > selectionSource ||
    selectionRangeStart > selectionRangeEnd ||
    selectionRangeEnd > documentSource ||
    selectionRangeEnd - selectionRangeStart !== selectionIncluded ||
    (!storyState.attached && storyRecordCount !== 0)
  ) {
    return undefined
  }

  return {
    version: 1,
    documentText: {
      sourceCharacters: documentSource,
      includedCharacters: documentIncluded,
      rangeStart: documentRangeStart,
      rangeEnd: documentRangeEnd,
    },
    selectionText: {
      explicitSelection: selectionText.explicitSelection,
      sourceCharacters: selectionSource,
      includedCharacters: selectionIncluded,
      rangeStart: selectionRangeStart,
      rangeEnd: selectionRangeEnd,
    },
    semanticBlocks: { count: blockCount, characters: blockCharacters },
    neighboringDocuments: { count: neighboringCount, characters: neighboringCharacters },
    storyState: { attached: storyState.attached, recordCount: storyRecordCount },
    storyContext: {
      recordCount: storyContextRecordCount,
      canonicalFactCount,
      hypothesisCount,
    },
    jit: { entityCount, promiseCount },
    ...(referenceMaterials ? { referenceMaterials } : {}),
  }
}

function readReferenceMaterialsCoverage(
  value: unknown,
): DesktopPreparedContextCoverage['referenceMaterials'] | undefined {
  const record = asRecord(value)
  if (!record || !Array.isArray(record.sources)) return undefined
  const sourceCount = readCount(record.sourceCount)
  const selectedCount = readCount(record.selectedCount)
  const includedCount = readCount(record.includedCount)
  const omittedCount = readCount(record.omittedCount)
  const includedCharacters = readCount(record.includedCharacters)
  if (
    sourceCount === undefined ||
    selectedCount === undefined ||
    includedCount === undefined ||
    omittedCount === undefined ||
    includedCharacters === undefined ||
    sourceCount !== record.sources.length
  ) {
    return undefined
  }

  const sources: ReferenceSourceDisclosure[] = []
  for (const value of record.sources) {
    const source = asRecord(value)
    const matchedPassages = readCount(source?.matchedPassages)
    const includedPassages = readCount(source?.includedPassages)
    const sourceCharacters = readCount(source?.includedCharacters)
    const reason = source?.omissionReason
    if (
      !source ||
      typeof source.sourceId !== 'string' ||
      typeof source.title !== 'string' ||
      typeof source.selected !== 'boolean' ||
      matchedPassages === undefined ||
      includedPassages === undefined ||
      sourceCharacters === undefined ||
      (reason !== undefined &&
        reason !== 'not-selected' &&
        reason !== 'no-matching-passages' &&
        reason !== 'context-budget')
    ) {
      return undefined
    }
    sources.push({
      sourceId: source.sourceId,
      title: source.title,
      selected: source.selected,
      matchedPassages,
      includedPassages,
      includedCharacters: sourceCharacters,
      ...(reason ? { omissionReason: reason as ReferenceMaterialOmissionReason } : {}),
    })
  }

  if (
    selectedCount !== sources.filter((source) => source.selected).length ||
    includedCount !== sources.filter((source) => source.includedPassages > 0).length ||
    omittedCount !== sources.filter((source) => source.omissionReason).length ||
    includedCharacters !== sources.reduce((total, source) => total + source.includedCharacters, 0)
  ) {
    return undefined
  }
  return {
    sourceCount,
    selectedCount,
    includedCount,
    omittedCount,
    includedCharacters,
    sources,
  }
}

function readCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
