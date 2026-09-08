import type { AiTask, TaskResult } from '@inkpi/protocol'
import { semanticTextFromContent } from '../../domain/content'
import { getPluginInstruction } from '../instructions/pluginInstructions'
import { isFirstPartyPluginId } from './pluginCatalog'

let taskSequence = 0

export interface PluginAnalysisRequest {
  pluginId: string
  input: unknown
  documentId?: string
  context?: unknown
  metadata?: Record<string, unknown>
}

export function createPluginAnalysisTask(request: PluginAnalysisRequest): AiTask {
  taskSequence += 1
  const analysisInput =
    typeof request.input === 'string'
      ? semanticTextFromContent(request.documentId ?? request.pluginId, request.input)
      : request.input

  return {
    id: `plugin-analysis-${request.pluginId}-${Date.now()}-${taskSequence}`,
    kind: `plugin.${request.pluginId}.analysis`,
    input: {
      text: typeof analysisInput === 'string' ? analysisInput : undefined,
      documentId: request.documentId,
      payload: {
        pluginId: request.pluginId,
        analysisInput,
        analysisContext: request.context,
        ...request.metadata,
      },
    },
    contextPolicy: {
      includeSelection: false,
      includeProjectState: false,
      metadata: { pluginId: request.pluginId, instructionId: getPluginInstruction(request.pluginId).id },
    },
    executionPolicy: {
      strategy: 'completion',
      mode: 'interactive',
      cancellable: true,
    },
    outputContract: { format: 'text', persistence: 'ephemeral' },
    effectPolicy: { mode: 'read-only' },
    requirements: {
      capabilities: ['plugin-analysis'],
      modalities: ['text'],
      outputFormats: ['text'],
      streaming: true,
    },
    metadata: {
      ...(isFirstPartyPluginId(request.pluginId)
        ? {}
        : { instruction: getPluginInstruction(request.pluginId).systemInstruction }),
      instructionId: getPluginInstruction(request.pluginId).id,
      instructionVersion: getPluginInstruction(request.pluginId).version,
      pluginId: request.pluginId,
      pluginCatalog: isFirstPartyPluginId(request.pluginId) ? 'first-party-v1' : 'extension',
      ...request.metadata,
    },
  }
}

export function taskResultText(result: TaskResult | null): string | null {
  if (!result || result.status !== 'completed' || result.output?.format !== 'text') return null
  return result.output.text
}
