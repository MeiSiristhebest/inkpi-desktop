import type { ChapterRecord, VolumeRecord } from './index'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { ScopedPluginEventBus } from '../core/pluginEventBus'

export interface ChapterMutationPatch {
  chapterId: string
  expectedRevision: number
  type: 'full_replace' | 'diff_hunks' | 'text_replace'
  content?: string
  search?: string | RegExp
  replacement?: string
  hunks?: Array<{ id: string; resolution: 'applied' | 'rejected' }>
}

export interface ChapterMutationResult {
  success: boolean
  conflict?: boolean
  currentRevision?: number
  updatedContent?: string
  error?: string
}

export interface DesktopPluginHostContextValue {
  projectId: string
  projectName: string
  activeChapter: ChapterRecord | null
  activeChapterId: string | null
  revision: number
  bookHierarchy: {
    volumes: VolumeRecord[]
    chapters: ChapterRecord[]
  }
  mutateActiveChapter: (patch: ChapterMutationPatch) => Promise<ChapterMutationResult>
  mutateCodexEntity: (
    entityId: string,
    mutation: (prev: CodexEntity) => Partial<CodexEntity>
  ) => Promise<void>
  refreshBookHierarchy: () => Promise<void>
  activeDrawerPluginId: string | null
  openDrawer: (pluginId: string) => void
  closeDrawer: () => void
  toggleDrawer: (pluginId: string) => void
  scopedBus?: ScopedPluginEventBus
}
