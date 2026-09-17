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
} from '../types/pluginHost'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { createPluginAnalysisTask, taskResultText } from '../ai'
import { resolvePluginContextProvider } from './pluginDefinitions'

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
  ) => Promise<unknown | null>
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
      return onAiTask(task)
    }
    return {
      isAvailable: !!isAiConnected,
      runTask,
      runPluginTask: async (
        pluginId: string,
        input: unknown,
        metadata?: Record<string, unknown>,
      ): Promise<string | null> => {
        try {
          const contextProvider = resolvePluginContextProvider(pluginId)
          const context = contextProvider
            ? await contextProvider({
                projectId,
                currentText: typeof input === 'string' ? input : (JSON.stringify(input) ?? ''),
                activeChapterId: activeChapter?.id,
              })
            : undefined
          return taskResultText(
            await runTask(
              createPluginAnalysisTask({
                pluginId,
                input,
                documentId: activeChapter?.id,
                context,
                metadata,
              }),
            ),
          )
        } catch {
          return null
        }
      },
      ...(onPluginTool
        ? {
            runPluginTool: async (pluginId: string, input: Record<string, unknown>) => {
              try {
                return await onPluginTool(pluginId, input)
              } catch {
                return null
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
                return await onPluginWorkflow(pluginId, input, metadata)
              } catch {
                return null
              }
            },
          }
        : {}),
    }
  }, [onAiTask, onPluginTool, onPluginWorkflow, isAiConnected, projectId, activeChapter?.id])

  const mutateActiveChapter = useCallback(
    async (patch: ChapterMutationPatch): Promise<ChapterMutationResult> => {
      if (!activeChapter || patch.chapterId !== activeChapter.id) {
        return {
          success: false,
          conflict: false,
          currentRevision: internalRevision,
          error: `Active chapter mismatch: expected active chapter id '${activeChapter?.id || 'none'}', got '${patch.chapterId}'`,
        }
      }

      let updatedContent = activeChapter.content || ''

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
        chapterId: activeChapter.id,
        activeChapterFallback: activeChapter,
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
      } else if (activeChapter) {
        activeChapter.content = resultingChapter.content
        activeChapter.revision = resultingChapter.revision
        activeChapter.wordCount = resultingChapter.wordCount
        activeChapter.updatedAt = resultingChapter.updatedAt
      }

      return {
        success: true,
        conflict: false,
        currentRevision: mutationResult.newRevision,
        updatedContent: mutationResult.chapter.content,
      }
    },
    [activeChapter, internalRevision, onChapterUpdate, projectId],
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

      scopedBus.emit('CODEX_ENTITY_TOUCHED', {
        projectId,
        entityId: merged.id,
        entityName: merged.name,
        category: merged.category || 'entity',
      })
    },
    [projectId, scopedBus],
  )

  const contextValue: DesktopPluginHostContextValue = useMemo(
    () => ({
      projectId,
      projectName,
      activeChapter,
      activeChapterId: activeChapter?.id || null,
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
      activeChapter,
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
