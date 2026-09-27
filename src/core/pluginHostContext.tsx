import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import type { ChapterRecord, VolumeRecord } from '../types'
import type { CodexEntity } from '../plugins/living-codex/types'
import { pluginEventBus } from './pluginEventBus'
import { chapterMutationService } from '../services/defaultChapterMutationService'
import { indexedDbCodexEntityRepository } from '../adapters/indexedDbCodexEntityRepository'
import { codexApplicationService } from '../services/domainApplicationServices'
import { clock } from '../adapters/clock'
import type {
  ChapterMutationPatch,
  ChapterMutationResult,
  DesktopPluginHostContextValue,
  PluginAnalysisResult,
  PluginWorkflowOutcome,
  PluginWorkflowProvenance,
} from '../types/pluginHost'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { createPluginAnalysisTask, taskResultText } from '../ai'
import { resolvePluginContextProvider } from './pluginDefinitions'
import {
  isSensitiveKey,
  redactPluginRecord,
  redactPluginValue,
  redactSensitiveString,
} from './pluginDataRedaction'

export const DesktopPluginHostContext = createContext<DesktopPluginHostContextValue | null>(null)

export interface DesktopPluginHostProviderProps {
  projectId: string
  projectName?: string
  activeChapter: ChapterRecord | null
  volumes?: VolumeRecord[]
  chapters?: ChapterRecord[]
  onChapterUpdate?: (updated: ChapterRecord) => void
  onRefreshHierarchy?: () => Promise<void>
  onAiTask?: (task: AiTask) => Promise<TaskResult | null>
  onPluginTool?: (pluginId: string, input: Record<string, unknown>) => Promise<unknown | null>
  onPluginWorkflow?: (
    pluginId: string,
    input: unknown,
    metadata?: Record<string, unknown>,
  ) => Promise<PluginWorkflowOutcome<unknown> | null>
  isAiConnected?: boolean
  children: ReactNode
}

export const DesktopPluginHostProvider: FC<DesktopPluginHostProviderProps> = ({
  projectId,
  projectName = 'InkPi Project',
  activeChapter,
  volumes = [],
  chapters = [],
  onChapterUpdate,
  onRefreshHierarchy,
  onAiTask,
  onPluginTool,
  onPluginWorkflow,
  isAiConnected = false,
  children,
}) => {
  const [activeDrawerPluginId, setActiveDrawerPluginId] = useState<string | null>(null)
  const [internalRevision, setInternalRevision] = useState<number>(activeChapter?.revision || 1)
  const [localMutationChapter, setLocalMutationChapter] = useState<ChapterRecord | null>(null)
  const resolvedActiveChapter =
    !onChapterUpdate &&
    activeChapter?.id === localMutationChapter?.id &&
    (localMutationChapter?.revision ?? 1) > (activeChapter?.revision ?? 1)
      ? localMutationChapter
      : activeChapter
  const resolvedActiveChapterId = resolvedActiveChapter?.id

  useEffect(() => {
    if (activeChapter) {
      setInternalRevision(activeChapter.revision || 1)
    }
  }, [activeChapter?.id, activeChapter?.revision])

  const scopedBus = useMemo(() => {
    return pluginEventBus.scopedBus(projectId)
  }, [projectId])

  const openDrawer = useCallback((pluginId: string) => {
    setActiveDrawerPluginId(pluginId)
  }, [])

  const closeDrawer = useCallback(() => {
    setActiveDrawerPluginId(null)
  }, [])

  const toggleDrawer = useCallback((pluginId: string) => {
    setActiveDrawerPluginId((prev) => (prev === pluginId ? null : pluginId))
  }, [])

  const refreshBookHierarchy = useCallback(async () => {
    if (onRefreshHierarchy) {
      await onRefreshHierarchy()
    }
  }, [onRefreshHierarchy])

  const aiAssistant = useMemo(() => {
    if (!onAiTask && !onPluginTool && !onPluginWorkflow) return undefined
    const runTask = async (task: AiTask): Promise<TaskResult | null> => {
      if (!onAiTask) return null
      try {
        // SAFETY: Redaction preserves the JSON-shaped AiTask fields while replacing sensitive values.
        const safeTask = redactPluginValue(task) as unknown as AiTask
        const result = await onAiTask(safeTask)
        // SAFETY: TaskResult is JSON-shaped; redaction preserves its status and field structure.
        return result ? (redactPluginValue(result) as unknown as TaskResult) : null
      } catch (cause) {
        throw new Error(safePluginError(cause))
      }
    }
    const runPluginAnalysis = async (
      pluginId: string,
      input: unknown,
      metadata?: Record<string, unknown>,
    ): Promise<PluginAnalysisResult | null> => {
      let taskId = `plugin-analysis-${pluginId}`
      const baseProvenance = (): PluginWorkflowProvenance => ({
        pluginId,
        workspaceId: projectId,
        taskId,
        timestamp: clock.now(),
      })
      try {
        const safeInput = redactPluginValue(input)
        const safeMetadata = redactPluginRecord(metadata)
        const contextProvider = resolvePluginContextProvider(pluginId)
        const context = contextProvider
          ? await contextProvider({
              projectId,
              currentText:
                typeof safeInput === 'string' ? safeInput : (JSON.stringify(safeInput) ?? ''),
              activeChapterId: resolvedActiveChapterId,
            })
          : undefined

        const task = createPluginAnalysisTask({
          pluginId,
          input: safeInput,
          workspaceId: projectId,
          documentId: resolvedActiveChapterId,
          context,
          metadata: safeMetadata,
        })
        taskId = task.id

        const taskResult = await runTask(task)
        const provenance = publicPluginProvenance(taskResult?.provenance, {
          ...baseProvenance(),
          taskId,
        })
        const artifactId = taskResult?.artifactIds?.[0] ?? provenance.artifactId
        const output = taskResultText(taskResult)
        const safeOutput = output === null ? null : redactSensitiveString(output)
        if (taskResult?.status === 'cancelled') {
          return {
            status: 'cancelled',
            taskId,
            pluginId,
            provenance,
            reason: safePluginError(taskResult.error?.message ?? 'Plugin task cancelled'),
          }
        }
        if (taskResult?.status === 'failed' || !taskResult || safeOutput === null) {
          return {
            status: 'failed',
            taskId,
            pluginId,
            provenance,
            error: safePluginError(
              taskResult?.error?.message ?? 'Plugin task returned no text output',
            ),
          }
        }
        return {
          status: 'completed',
          taskId,
          pluginId,
          artifactId,
          artifactContent: safeOutput,
          result: safeOutput,
          provenance,
        }
      } catch (cause) {
        return {
          status: 'failed',
          taskId,
          pluginId,
          provenance: baseProvenance(),
          error: safePluginError(cause),
        }
      }
    }
    const runPluginTask = async (
      pluginId: string,
      input: unknown,
      metadata?: Record<string, unknown>,
    ): Promise<string | null> => {
      try {
        const safeInput = redactPluginValue(input)
        const safeMetadata = redactPluginRecord(metadata)
        const contextProvider = resolvePluginContextProvider(pluginId)
        const context = contextProvider
          ? await contextProvider({
              projectId,
              currentText:
                typeof safeInput === 'string' ? safeInput : (JSON.stringify(safeInput) ?? ''),
              activeChapterId: resolvedActiveChapterId,
            })
          : undefined

        const task = createPluginAnalysisTask({
          pluginId,
          input: safeInput,
          workspaceId: projectId,
          documentId: resolvedActiveChapterId,
          context,
          metadata: safeMetadata,
        })

        const taskResult = await runTask(task)

        if (taskResult?.status === 'cancelled') {
          throw new Error(`Plugin task cancelled: ${pluginId}`)
        }
        if (taskResult?.status === 'failed') {
          throw new Error(
            safePluginError(taskResult.error?.message ?? `Plugin task failed: ${pluginId}`),
          )
        }
        const output = taskResultText(taskResult)
        if (output === null) {
          throw new Error(`Plugin task completed without text output: ${pluginId}`)
        }
        return redactSensitiveString(output)
      } catch (cause) {
        throw new Error(safePluginError(cause))
      }
    }
    return {
      isAvailable: !!isAiConnected,
      runTask,
      runPluginAnalysis,
      runPluginOutcome: runPluginAnalysis,
      runPluginTask,
      ...(onPluginTool
        ? {
            runPluginTool: async (pluginId: string, input: Record<string, unknown>) => {
              try {
                const result = await onPluginTool(
                  pluginId,
                  redactPluginValue(input) as Record<string, unknown>,
                )
                return redactPluginValue(result)
              } catch (cause) {
                throw new Error(safePluginError(cause))
              }
            },
          }
        : {}),
      ...(onPluginWorkflow
        ? {
            runPluginWorkflow: async (
              pluginId: string,
              input: unknown,
              metadata?: Record<string, unknown>,
            ) => {
              try {
                const result = await onPluginWorkflow(
                  pluginId,
                  redactPluginValue(input),
                  redactPluginRecord(metadata),
                )
                if (!result) return result
                return {
                  ...result,
                  ...(result.status === 'completed'
                    ? {
                        result: redactPluginValue(result.result),
                        ...(result.artifactContent !== undefined
                          ? { artifactContent: redactPluginValue(result.artifactContent) }
                          : {}),
                      }
                    : {}),
                  ...(result.status === 'failed'
                    ? { error: redactSensitiveString(result.error) }
                    : {}),
                  ...(result.status === 'cancelled' && result.reason
                    ? { reason: redactSensitiveString(result.reason) }
                    : {}),
                }
              } catch (cause) {
                throw new Error(safePluginError(cause))
              }
            },
          }
        : {}),
    }
  }, [onAiTask, onPluginTool, onPluginWorkflow, isAiConnected, projectId, resolvedActiveChapterId])

  const mutateActiveChapter = useCallback(
    async (patch: ChapterMutationPatch): Promise<ChapterMutationResult> => {
      if (!resolvedActiveChapter || patch.chapterId !== resolvedActiveChapter.id) {
        return {
          success: false,
          conflict: false,
          currentRevision: internalRevision,
          error: `Active chapter mismatch: expected active chapter id '${resolvedActiveChapter?.id || 'none'}', got '${patch.chapterId}'`,
        }
      }

      let updatedContent = resolvedActiveChapter.content || ''

      if (patch.type === 'full_replace') {
        updatedContent = patch.content ?? ''
      } else if (patch.type === 'text_replace') {
        if (patch.search !== undefined && patch.replacement !== undefined) {
          if (typeof patch.search === 'string') {
            updatedContent = updatedContent.replaceAll(patch.search, patch.replacement)
          } else {
            updatedContent = updatedContent.replace(patch.search, patch.replacement)
          }
        }
      } else if (patch.type === 'diff_hunks' && patch.content !== undefined) {
        updatedContent = patch.content
      }

      // Delegate authoritative mutation to ChapterMutationService
      const mutationResult = await chapterMutationService.mutate({
        workspaceId: projectId,
        chapterId: resolvedActiveChapter.id,
        activeChapterFallback: resolvedActiveChapter,
        expectedRevision: patch.expectedRevision ?? internalRevision,
        mutation: { type: 'replace-content', content: updatedContent },
        origin: 'plugin',
      })

      if (!mutationResult.success) {
        return {
          success: false,
          conflict: mutationResult.conflict,
          currentRevision: mutationResult.currentRevision ?? internalRevision,
          error: mutationResult.error,
        }
      }

      setInternalRevision(mutationResult.newRevision)

      const resultingChapter = mutationResult.chapter
      if (onChapterUpdate) {
        onChapterUpdate(resultingChapter)
      } else {
        setLocalMutationChapter(resultingChapter)
      }

      return {
        success: true,
        conflict: false,
        currentRevision: mutationResult.newRevision,
        updatedContent: mutationResult.chapter.content,
      }
    },
    [resolvedActiveChapter, internalRevision, onChapterUpdate, projectId],
  )

  const mutateCodexEntity = useCallback(
    async (
      entityId: string,
      mutation: (prev: CodexEntity) => Partial<CodexEntity>,
    ): Promise<void> => {
      const allEntities = await indexedDbCodexEntityRepository.getAll()
      const existing = allEntities.find((e) => e.id === entityId)
      if (!existing) {
        throw new Error(`Codex entity not found: ${entityId}`)
      }
      const patch = mutation(existing)
      const merged: CodexEntity = {
        ...existing,
        ...patch,
        updatedAt: clock.now(),
      }
      await codexApplicationService.saveEntity(merged, 'author-confirmed')
    },
    [],
  )

  const contextValue: DesktopPluginHostContextValue = useMemo(
    () => ({
      projectId,
      projectName,
      activeChapter: resolvedActiveChapter,
      activeChapterId: resolvedActiveChapter?.id || null,
      revision: internalRevision,
      bookHierarchy: {
        volumes,
        chapters,
      },
      mutateActiveChapter,
      mutateCodexEntity,
      refreshBookHierarchy,
      activeDrawerPluginId,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      scopedBus,
      aiAssistant,
    }),
    [
      projectId,
      projectName,
      resolvedActiveChapter,
      internalRevision,
      volumes,
      chapters,
      mutateActiveChapter,
      mutateCodexEntity,
      refreshBookHierarchy,
      activeDrawerPluginId,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      scopedBus,
      aiAssistant,
    ],
  )

  return (
    <DesktopPluginHostContext.Provider value={contextValue}>
      {children}
    </DesktopPluginHostContext.Provider>
  )
}

function publicPluginProvenance(
  value: unknown,
  base: PluginWorkflowProvenance,
): PluginWorkflowProvenance {
  if (!isRecord(value)) return base
  const next = { ...base }
  for (const key of ['artifactId', 'routeId', 'runtimeTarget', 'provider', 'model'] as const) {
    const item = value[key]
    if (typeof item === 'string' && item.trim() && !isSensitiveKey(key)) next[key] = item
  }
  return next
}

function safePluginError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value)
  if (!message.trim()) return 'Plugin task failed'
  return redactSensitiveString(message).slice(0, 500)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function usePluginHostContext(): DesktopPluginHostContextValue {
  const ctx = useContext(DesktopPluginHostContext)
  if (!ctx) {
    throw new Error('usePluginHostContext 必须在 <DesktopPluginHostProvider> 内使用')
  }
  return ctx
}

export function useOptionalPluginHostContext(): DesktopPluginHostContextValue | null {
  return useContext(DesktopPluginHostContext)
}
