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
import { buildJitQuery } from '../context/jitQueryBuilder'
import { createTaskScope } from '../../types/taskScope'

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
  /** 任务归属的 Workspace（INV-03）——所有 creative task 必须携带 */
  workspaceId: string
  /** 当前 workspace 的领域修订号（INV-06）；默认 1，生产应从 ActiveWritingContext.workspaceRevision 读取 */
  workspaceRevision?: number
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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>
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
    intent: input.instruction,
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
    intent: input.instruction ?? input.question,
    requirements: {
      capabilities: ['creative-assistant'],
      modalities: ['text'],
      outputFormats: ['text'],
      streaming: true,
    },
    extra: {
      question: input.question,
      ...(input.conversationHistory ? { conversationHistory: input.conversationHistory } : {}),
    },
  })
}

export function createRewriteTask(input: RewriteTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.rewrite, input, {
    executionPolicy: INTERACTIVE_SINGLE_PASS,
    outputContract: PATCH_OUTPUT,
    effectPolicy: PROPOSAL_EFFECT,
    intent: input.instruction ?? input.goal,
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
    intent: input.instruction,
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
    intent: input.instruction ?? input.question,
    requirements: {
      capabilities: ['creative-reasoning'],
      modalities: ['text'],
      outputFormats: ['structured'],
      needsReasoning: true,
    },
    extra: { question: input.question, depth: input.depth ?? 'thorough' },
  })
}

export function createDistillationTask(input: DistillationTaskInput): AiTask {
  return createCreativeTask(CREATIVE_TASK_KINDS.distillation, input, {
    executionPolicy: BACKGROUND_WORKFLOW,
    outputContract: STRUCTURED_OUTPUT,
    effectPolicy: READ_ONLY_EFFECT,
    intent: input.instruction,
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
    intent?: string
    requirements: NonNullable<AiTask['requirements']>
    extra: Record<string, unknown>
  },
): AiTask {
  const context = compileCreativeContext({
    ...input,
    taskKind: kind,
    totalTokenBudget: options.requirements.streaming ? 4000 : 8000,
  })
  const selection = toTaskSelection(input.document, input.selection)

  // 生产级 JIT Query Builder：结合正文、选区、指令、StoryState 进行实体挖掘与拓扑展开
  const jitQuery = buildJitQuery({
    workspaceId: input.workspaceId,
    currentDocumentId: input.document.documentId,
    currentDocumentText: context.text,
    selectionText: context.selectionText,
    userPrompt: options.intent ?? input.instruction,
    storyState: input.storyState,
    activeReferences: options.extra?.activeReferences as string[] | undefined,
  })

  // INV-03 / INV-06: 每个 AI 任务必须携带显式 scope，包含 workspaceId、workspaceRevision、
  // 章节 ID、revision 与选区——让 Runtime JIT、缓存、Artifact 作用域严格隔离
  const scope = createTaskScope({
    workspaceId: input.workspaceId,
    workspaceRevision: input.workspaceRevision ?? 1,
    documentId: input.document.documentId,
    documentRevision: input.document.revision,
    selection: input.selection ? { from: input.selection.from, to: input.selection.to } : undefined,
  })
  return {
    id: input.taskId,
    kind,
    scope,
    input: {
      documentId: input.document.documentId,
      text: context.selectionText || context.text,
      selection,
      payload: {
        context,
        workspaceId: input.workspaceId,
        activeReferences: jitQuery.activeReferences,
        keywords: jitQuery.keywords,
        matchedEntityIds: jitQuery.matchedEntityIds,
        expandedEntityIds: jitQuery.expandedEntityIds,
        relevantPromiseIds: jitQuery.relevantPromiseIds,
        ...options.extra,
      },
    },
    contextPolicy: {
      providerIds: ['creative.document', 'creative.story', 'retrieval.jit'],
      includeSelection: true,
      includeProjectState: Boolean(input.storyState),
      metadata: {
        contextFingerprint: context.fingerprint,
        workspaceId: input.workspaceId,
        activeReferences: jitQuery.activeReferences,
        keywords: jitQuery.keywords,
      },
    },
    executionPolicy: { ...options.executionPolicy },
    outputContract: { ...options.outputContract },
    effectPolicy: { ...options.effectPolicy },
    ...(options.intent ? { intent: options.intent } : {}),
    requirements: { ...options.requirements },
    metadata: {
      ...input.metadata,
      contextFingerprint: context.fingerprint,
      workspaceId: input.workspaceId,
    },
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
