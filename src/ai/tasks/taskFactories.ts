import type {
  AiTask,
  EffectPolicy,
  ExecutionPolicy,
  OutputContract,
  TaskSelection,
} from '@inkpi/protocol'
import type { SemanticDocument } from '../../domain/content'
import type { StoryState } from '../../domain/story'
import { compileCreativeContext, type CreativeContext } from '../context/contextCompiler'

export const CREATIVE_TASK_KINDS = {
  assistant: 'creative.assistant',
  continue: 'creative.continue',
  rewrite: 'creative.rewrite',
  continuityAudit: 'narrative.continuity.audit',
  deepReasoning: 'narrative.deep.reason',
  distillation: 'narrative.project.distill',
} as const

export type CreativeTaskKind = (typeof CREATIVE_TASK_KINDS)[keyof typeof CREATIVE_TASK_KINDS]

export interface CreativeTaskBaseInput {
  taskId: string
  document: SemanticDocument
  selection?: { from: number; to: number }
  neighboringDocuments?: SemanticDocument[]
  storyState?: StoryState
  instruction?: string
  metadata?: Record<string, unknown>
}

export interface ContinueTaskInput extends CreativeTaskBaseInput {
  tone?: string
  targetCharacters?: number
}

export interface AssistantTaskInput extends CreativeTaskBaseInput {
  question: string
}

export interface RewriteTaskInput extends CreativeTaskBaseInput {
  goal: string
  preserveFacts?: boolean
}

export interface ContinuityAuditTaskInput extends CreativeTaskBaseInput {
  scope?: 'selection' | 'document' | 'project'
}

export interface DeepReasoningTaskInput extends CreativeTaskBaseInput {
  question: string
  depth?: 'focused' | 'thorough'
}

export interface DistillationTaskInput extends CreativeTaskBaseInput {
  target: 'scene' | 'document' | 'project'
  fields?: string[]
}

const INTERACTIVE_SINGLE_PASS: ExecutionPolicy = {
  strategy: 'completion',
  mode: 'interactive',
  cancellable: true,
}

const INTERACTIVE_REASONING: ExecutionPolicy = {
  strategy: 'reasoning',
  mode: 'interactive',
  cancellable: true,
}

const BACKGROUND_WORKFLOW: ExecutionPolicy = {
  strategy: 'workflow',
  mode: 'background',
  priority: -10,
  cancellable: true,
  checkpointIntervalMs: 5_000,
}

const PROPOSAL_EFFECT: EffectPolicy = { mode: 'proposal', requiresApproval: true }
const READ_ONLY_EFFECT: EffectPolicy = { mode: 'read-only' }

const TEXT_OUTPUT: OutputContract = { format: 'text', persistence: 'ephemeral' }
const PATCH_OUTPUT: OutputContract = { format: 'patch', persistence: 'artifact' }
const STRUCTURED_OUTPUT: OutputContract = { format: 'structured', persistence: 'artifact' }

export function createContinueTask(input: ContinueTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.continue, input, {
    executionPolicy: INTERACTIVE_SINGLE_PASS,
    outputContract: TEXT_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    requirements: {
      capabilities: ['creative-writing'],
      modalities: ['text'],
      outputFormats: ['text'],
      streaming: true,
    },
    extra: { tone: input.tone, targetCharacters: input.targetCharacters },
  })
}

export function createAssistantTask(input: AssistantTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.assistant, input, {
    executionPolicy: INTERACTIVE_SINGLE_PASS,
    outputContract: TEXT_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    requirements: {
      capabilities: ['creative-assistant'],
      modalities: ['text'],
      outputFormats: ['text'],
      streaming: true,
    },
    extra: { question: input.question },
  })
}

export function createRewriteTask(input: RewriteTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.rewrite, input, {
    executionPolicy: INTERACTIVE_SINGLE_PASS,
    outputContract: PATCH_OUTPUT,
    effectPolicy: PROPOSAL_EFFECT,
    requirements: {
      capabilities: ['creative-writing', 'text-rewrite'],
      modalities: ['text'],
      outputFormats: ['patch'],
    },
    extra: { goal: input.goal, preserveFacts: input.preserveFacts ?? true },
  })
}

export function createContinuityAuditTask(input: ContinuityAuditTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.continuityAudit, input, {
    executionPolicy: BACKGROUND_WORKFLOW,
    outputContract: STRUCTURED_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    requirements: {
      capabilities: ['continuity-audit'],
      modalities: ['text'],
      outputFormats: ['structured'],
    },
    extra: { scope: input.scope ?? 'document' },
  })
}

export function createDeepReasoningTask(input: DeepReasoningTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.deepReasoning, input, {
    executionPolicy: INTERACTIVE_REASONING,
    outputContract: STRUCTURED_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    requirements: {
      capabilities: ['creative-reasoning'],
      modalities: ['text'],
      outputFormats: ['structured'],
    },
    extra: { question: input.question, depth: input.depth ?? 'thorough' },
  })
}

export function createDistillationTask(input: DistillationTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.distillation, input, {
    executionPolicy: BACKGROUND_WORKFLOW,
    outputContract: STRUCTURED_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    requirements: {
      capabilities: ['creative-distillation'],
      modalities: ['text'],
      outputFormats: ['structured'],
    },
    extra: { target: input.target, fields: input.fields || [] },
  })
}

function createCreativeTask(
  kind: CreativeTaskKind,
  input: CreativeTaskBaseInput,
  options: {
    executionPolicy: ExecutionPolicy
    outputContract: OutputContract
    effectPolicy: EffectPolicy
    requirements: NonNullable<AiTask['requirements']>
    extra: Record<string, unknown>
  },
): AiTask {
  const context = compileCreativeContext(input)
  const selection = toTaskSelection(input.document, input.selection)
  return {
    id: input.taskId,
    kind,
    input: {
      documentId: input.document.documentId,
      text: context.selectionText || context.text,
      selection,
      payload: {
        context,
        ...options.extra,
      },
    },
    contextPolicy: {
      providerIds: ['creative.document', 'creative.story', 'retrieval.jit'],
      includeSelection: true,
      includeProjectState: Boolean(input.storyState),
      metadata: { contextFingerprint: context.fingerprint },
    },
    executionPolicy: { ...options.executionPolicy },
    outputContract: { ...options.outputContract },
    effectPolicy: { ...options.effectPolicy },
    requirements: { ...options.requirements },
    metadata: { ...input.metadata, contextFingerprint: context.fingerprint, instruction: input.instruction },
  }
}

function toTaskSelection(
  document: SemanticDocument,
  selection: { from: number; to: number } | undefined,
): TaskSelection | undefined {
  if (!selection) return undefined
  const from = Math.max(0, Math.min(document.text.length, selection.from))
  const to = Math.max(from, Math.min(document.text.length, selection.to))
  const blockIds = document.blocks
    .filter((block) => block.to >= from && block.from <= to)
    .map((block) => block.id)
  return { documentId: document.documentId, from, to, blockIds, revision: document.revision }
}

export type { CreativeContext }
