import type { TaskResult, TaskOutput } from '@inkpi/protocol'
import type { SemanticDocument } from '../../domain/content'
import type { SourceEvidence } from '../../domain/story/provenance'

export interface ContinuityFinding {
  id: string
  severity: 'info' | 'warning' | 'error'
  description: string
  entityIds?: string[]
  blockIds?: string[]
  evidence?: string
}

export interface DistilledStoryFacts {
  summary: string
  entities: Array<
    DistilledSource & {
      id?: string
      kind: string
      name: string
      attributes?: Record<string, unknown>
    }
  >
  events: Array<
    DistilledSource & { id?: string; type: string; description?: string; entityIds?: string[] }
  >
  promises: Array<DistilledSource & { id?: string; statement: string; status?: string }>
  confidence?: number
}

interface DistilledSource {
  sourceDocumentId?: string
  sourceBlockId?: string
  sourceRevision?: number
  evidence?: SourceEvidence[]
}

export interface DeepReasoningResult {
  answer: string
  assumptions: string[]
  alternatives: string[]
  risks: string[]
}

export function requireTextResult(result: TaskResult): string {
  const output = requireOutput(result, 'text')
  if (output.format !== 'text') throw new Error('Unreachable text output type')
  return output.text
}

export function requirePatchResult(result: TaskResult): unknown {
  const output = requireOutput(result, 'patch')
  if (output.format !== 'patch') throw new Error('Unreachable patch output type')
  return output.patch
}

export function requireStructuredResult<T>(result: TaskResult): T {
  const output = requireOutput(result, 'structured')
  if (output.format !== 'structured') throw new Error('Unreachable structured output type')
  return output.data as T
}

export function parseContinuityFindings(
  result: TaskResult,
  sourceDocuments: SemanticDocument[] = [],
): ContinuityFinding[] {
  const value = requireStructuredResult<unknown>(result)
  const findings = normalizeContinuityFindings(value)
  if (!Array.isArray(findings)) throw new Error('Continuity audit output must be an array')
  return findings.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Continuity finding ${index} is invalid`)
    const finding = item as Record<string, unknown>
    const severity = finding.severity
    if (severity !== 'info' && severity !== 'warning' && severity !== 'error') {
      throw new Error(`Continuity finding ${index} has an invalid severity`)
    }
    if (typeof finding.description !== 'string') {
      throw new Error(`Continuity finding ${index} is missing a description`)
    }
    const evidence = typeof finding.evidence === 'string' ? finding.evidence : undefined
    let blockIds = asStringArray(finding.blockIds)
    let verifiedEvidence = evidence
    if (sourceDocuments.length > 0) {
      const matchingBlockIds = new Set(
        sourceDocuments.flatMap((document) =>
          evidence
            ? document.blocks
                .filter((block) => block.text.includes(evidence))
                .map((block) => block.id)
            : [],
        ),
      )
      const verifiedBlockIds = [...new Set(blockIds ?? [])].filter((blockId) =>
        matchingBlockIds.has(blockId),
      )
      if (verifiedBlockIds.length > 0) {
        blockIds = verifiedBlockIds
      } else if (evidence && matchingBlockIds.size === 1) {
        blockIds = [...matchingBlockIds]
      } else {
        blockIds = undefined
        verifiedEvidence = undefined
      }
    }
    return {
      id: typeof finding.id === 'string' ? finding.id : `finding-${index}`,
      severity,
      description: finding.description,
      entityIds: asStringArray(finding.entityIds),
      blockIds,
      evidence: verifiedEvidence,
    }
  })
}

function normalizeContinuityFindings(value: unknown): unknown {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const findings = (value as Record<string, unknown>).findings
    if (Array.isArray(findings)) return findings
  }
  return value
}

export function parseDistilledFacts(
  result: TaskResult,
  sourceDocuments: SemanticDocument[] = [],
): DistilledStoryFacts {
  const value = requireStructuredResult<unknown>(result)
  if (!value || typeof value !== 'object') throw new Error('Distillation output must be an object')
  const data = value as Record<string, unknown>
  if (typeof data.summary !== 'string') throw new Error('Distillation output is missing summary')
  return {
    summary: data.summary,
    entities: parseNamedItems(data.entities, sourceDocuments),
    events: parseEventItems(data.events, sourceDocuments),
    promises: parsePromiseItems(data.promises, sourceDocuments),
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
  }
}

export function parseDeepReasoning(result: TaskResult): DeepReasoningResult {
  const value = requireStructuredResult<unknown>(result)
  if (!value || typeof value !== 'object')
    throw new Error('Deep reasoning output must be an object')
  const data = value as Record<string, unknown>
  if (typeof data.answer !== 'string') throw new Error('Deep reasoning output is missing answer')
  return {
    answer: data.answer,
    assumptions: asStringArray(data.assumptions) || [],
    alternatives: asStringArray(data.alternatives) || [],
    risks: asStringArray(data.risks) || [],
  }
}

function requireOutput(result: TaskResult, format: TaskOutput['format']): TaskOutput {
  if (result.status !== 'completed' && result.status !== 'waiting-user') {
    throw new Error(result.error?.message || `Task did not complete: ${result.status}`)
  }
  if (!result.output) throw new Error('Task result has no output')
  if (result.output.format !== format) {
    throw new Error(`Expected ${format} task output, received ${result.output.format}`)
  }
  return result.output
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Expected an array of strings')
  }
  return [...value]
}

function parseNamedItems(
  value: unknown,
  sourceDocuments: SemanticDocument[],
): DistilledStoryFacts['entities'] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid distilled entity')
    const data = item as Record<string, unknown>
    if (typeof data.kind !== 'string' || typeof data.name !== 'string') {
      throw new Error('Distilled entities require kind and name')
    }
    return {
      id: typeof data.id === 'string' ? data.id : undefined,
      kind: data.kind,
      name: data.name,
      ...resolveDistilledSource(data, sourceDocuments),
      attributes:
        data.attributes && typeof data.attributes === 'object'
          ? { ...(data.attributes as Record<string, unknown>) }
          : undefined,
    }
  })
}

function parseEventItems(
  value: unknown,
  sourceDocuments: SemanticDocument[],
): DistilledStoryFacts['events'] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid distilled event')
    const data = item as Record<string, unknown>
    if (typeof data.type !== 'string') throw new Error('Distilled events require type')
    return {
      id: typeof data.id === 'string' ? data.id : undefined,
      type: data.type,
      description: typeof data.description === 'string' ? data.description : undefined,
      entityIds: asStringArray(data.entityIds),
      ...resolveDistilledSource(data, sourceDocuments),
    }
  })
}

function parsePromiseItems(
  value: unknown,
  sourceDocuments: SemanticDocument[],
): DistilledStoryFacts['promises'] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid distilled promise')
    const data = item as Record<string, unknown>
    if (typeof data.statement !== 'string') throw new Error('Distilled promises require statement')
    return {
      id: typeof data.id === 'string' ? data.id : undefined,
      statement: data.statement,
      status: typeof data.status === 'string' ? data.status : undefined,
      ...resolveDistilledSource(data, sourceDocuments),
    }
  })
}

function resolveDistilledSource(
  candidate: Record<string, unknown>,
  sourceDocuments: SemanticDocument[],
): DistilledSource {
  const documentId = candidate.sourceDocumentId
  const excerpt = candidate.evidence
  if (typeof documentId !== 'string' || typeof excerpt !== 'string' || excerpt.length === 0) {
    return {}
  }

  const matchingDocuments = sourceDocuments.filter((source) => source.documentId === documentId)
  if (matchingDocuments.length !== 1) return {}
  const document = matchingDocuments[0]
  if (!document || !Number.isSafeInteger(document.revision) || document.revision < 0) {
    return {}
  }
  const semanticFrom = document.text.indexOf(excerpt)
  if (semanticFrom < 0) return {}
  const semanticTo = semanticFrom + excerpt.length
  const overlappingBlocks = document.blocks.filter(
    (block) => block.from < semanticTo && block.to > semanticFrom,
  )
  const block =
    overlappingBlocks.length === 1 &&
    overlappingBlocks[0].from <= semanticFrom &&
    overlappingBlocks[0].to >= semanticTo
      ? overlappingBlocks[0]
      : undefined

  return {
    sourceDocumentId: document.documentId,
    sourceBlockId: block?.id,
    sourceRevision: document.revision,
    evidence: [
      {
        documentId: document.documentId,
        ...(block ? { blockId: block.id } : {}),
        excerpt,
        semanticFrom,
        semanticTo,
      },
    ],
  }
}
