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
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { indexedDbCodexEntityRepository } from '../adapters/indexedDbCodexEntityRepository'
import { clock } from '../adapters/clock'
import type {
  ChapterMutationPatch,
  ChapterMutationResult,
  DesktopPluginHostContextValue,
} from '../types/pluginHost'

export const DesktopPluginHostContext = createContext<DesktopPluginHostContextValue | null>(null)

export interface DesktopPluginHostProviderProps {
  projectId: string
  projectName?: string
  activeChapter: ChapterRecord | null
  volumes?: VolumeRecord[]
  chapters?: ChapterRecord[]
  onChapterUpdate?: (updated: ChapterRecord) => void
  onRefreshHierarchy?: () => Promise<void>
  onAiPrompt?: (text: string, chapterId?: string) => void
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
  onAiPrompt,
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
    if (!onAiPrompt) return undefined
    return {
      isAvailable: !!isAiConnected,
      prompt: async (instruction: string): Promise<string | null> => {
        try {
          onAiPrompt(instruction, activeChapter?.id)
          return 'AI 请求已发送至副驾驶'
        } catch {
          return null
        }
      },
    }
  }, [onAiPrompt, isAiConnected, activeChapter?.id])

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

      if (patch.expectedRevision !== internalRevision) {
        return {
          success: false,
          conflict: true,
          currentRevision: internalRevision,
          error: `CAS Conflict: Expected revision ${patch.expectedRevision}, but current revision is ${internalRevision}`,
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

      const nextRevision = internalRevision + 1
      const now = clock.now()
      const updatedRecord: ChapterRecord = {
        ...activeChapter,
        content: updatedContent,
        revision: nextRevision,
        updatedAt: now,
      }

      setInternalRevision(nextRevision)

      // Persist to IndexedDB via repository
      try {
        await indexedDbProjectRepository.saveChapter(updatedRecord)
      } catch (err) {
        console.warn('[DesktopPluginHostProvider] Error persisting chapter:', err)
      }

      if (onChapterUpdate) {
        onChapterUpdate(updatedRecord)
      }

      return {
        success: true,
        conflict: false,
        currentRevision: nextRevision,
        updatedContent,
      }
    },
    [activeChapter, internalRevision, onChapterUpdate],
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
      await indexedDbCodexEntityRepository.save(merged)

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
