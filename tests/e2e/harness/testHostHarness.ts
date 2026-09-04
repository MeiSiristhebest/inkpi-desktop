import { db } from '../../../src/db/indexedDB'
import type { ChapterRecord, VolumeRecord } from '../../../src/types'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import { pluginEventBus, type PluginEventType, type PluginEventPayloads } from '../../../src/core/pluginEventBus'
import fs from 'node:fs'
import path from 'node:path'

export interface ChapterMutationPatch {
  chapterId: string
  expectedRevision: number // CAS token
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

export interface ScopedPluginEventBus {
  projectId: string
  emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]): void
  on<T extends PluginEventType>(type: T, handler: (payload: PluginEventPayloads[T]) => void): () => void
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
}

/**
 * Diagnostic helper to check if a source file exists under src/
 */
export function checkSourceFileExists(relativePathFromSrc: string): boolean {
  const projectRoot = path.resolve(__dirname, '../../../')
  const targetPath = path.join(projectRoot, 'src', relativePathFromSrc)
  return fs.existsSync(targetPath)
}

/**
 * Creates an isolated ScopedPluginEventBus contract instance for a given tenant
 */
export function createScopedEventBus(projectId: string): ScopedPluginEventBus {
  // Checks if pluginEventBus has scopedBus implementation
  const busAny = pluginEventBus as any
  if (typeof busAny.scopedBus === 'function') {
    return busAny.scopedBus(projectId)
  }

  // Reference opaque-box scoped bus wrapper ensuring tenant filtering
  return {
    projectId,
    emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]) {
      // Force payload.projectId = projectId to prevent spoofing
      pluginEventBus.emit(type, { ...payload, projectId })
    },
    on<T extends PluginEventType>(type: T, handler: (payload: PluginEventPayloads[T]) => void) {
      return pluginEventBus.on(type, (eventPayload) => {
        // Enforce strict tenant filtering
        if (eventPayload && (eventPayload as any).projectId === projectId) {
          handler(eventPayload)
        }
      })
    },
  }
}

/**
 * In-Memory Opaque-Box Test Host Context Harness
 * Implements the full contract from PROJECT.md § Interface Contracts
 */
export class TestHostHarness {
  public projectId: string
  public projectName: string
  public activeChapter: ChapterRecord | null = null
  public activeChapterId: string | null = null
  public revision: number = 1
  public bookHierarchy: { volumes: VolumeRecord[]; chapters: ChapterRecord[] } = {
    volumes: [],
    chapters: [],
  }
  public activeDrawerPluginId: string | null = null
  public scopedBus: ScopedPluginEventBus

  private codexStore = new Map<string, CodexEntity>()

  constructor(projectId: string, projectName: string = 'Test Project') {
    this.projectId = projectId
    this.projectName = projectName
    this.scopedBus = createScopedEventBus(projectId)
  }

  public setActiveChapter(chapter: ChapterRecord): void {
    this.activeChapter = { ...chapter }
    this.activeChapterId = chapter.id
    this.revision = (chapter as any).revision || 1
  }

  public setHierarchy(volumes: VolumeRecord[], chapters: ChapterRecord[]): void {
    this.bookHierarchy = {
      volumes: [...volumes],
      chapters: [...chapters],
    }
  }

  public setCodexEntity(entity: CodexEntity): void {
    this.codexStore.set(entity.id, { ...entity })
  }

  public getCodexEntity(entityId: string): CodexEntity | undefined {
    return this.codexStore.get(entityId)
  }

  /**
   * CAS Optimistic Concurrency Control Mutator
   */
  public async mutateActiveChapter(patch: ChapterMutationPatch): Promise<ChapterMutationResult> {
    if (!this.activeChapter || this.activeChapter.id !== patch.chapterId) {
      return {
        success: false,
        error: `Active chapter mismatch or not found: requested ${patch.chapterId}, current ${this.activeChapter?.id}`,
      }
    }

    // CAS check: compare expectedRevision with current revision token
    if (patch.expectedRevision !== this.revision) {
      return {
        success: false,
        conflict: true,
        currentRevision: this.revision,
        error: `CAS Conflict: expected revision ${patch.expectedRevision}, but current revision is ${this.revision}`,
      }
    }

    let newContent = this.activeChapter.content

    if (patch.type === 'full_replace' && patch.content !== undefined) {
      newContent = patch.content
    } else if (patch.type === 'text_replace' && patch.search !== undefined && patch.replacement !== undefined) {
      newContent = newContent.replace(patch.search, patch.replacement)
    } else if (patch.type === 'diff_hunks' && patch.hunks) {
      // Apply accepted hunks
      newContent = patch.content || newContent
    }

    // Atomically bump monotonic revision token
    this.revision += 1
    this.activeChapter = {
      ...this.activeChapter,
      content: newContent,
      updatedAt: Date.now(),
      ...({ revision: this.revision } as any),
    }

    // Update in hierarchy
    const idx = this.bookHierarchy.chapters.findIndex((c) => c.id === patch.chapterId)
    if (idx !== -1) {
      this.bookHierarchy.chapters[idx] = { ...this.activeChapter }
    }

    // Emit content update event on bus
    this.scopedBus.emit('CHAPTER_CONTENT_AUDITED', {
      projectId: this.projectId,
      chapterId: patch.chapterId,
      wordCount: newContent.length,
    })

    return {
      success: true,
      conflict: false,
      currentRevision: this.revision,
      updatedContent: newContent,
    }
  }

  public async mutateCodexEntity(
    entityId: string,
    mutation: (prev: CodexEntity) => Partial<CodexEntity>
  ): Promise<void> {
    const existing = this.codexStore.get(entityId)
    if (!existing) {
      throw new Error(`Codex entity ${entityId} not found in test harness store`)
    }

    const updated: CodexEntity = {
      ...existing,
      ...mutation(existing),
      updatedAt: Date.now(),
    }

    this.codexStore.set(entityId, updated)

    this.scopedBus.emit('CODEX_ENTITY_TOUCHED', {
      projectId: this.projectId,
      entityId,
      entityName: updated.name,
      category: updated.category,
    })
  }

  public async refreshBookHierarchy(): Promise<void> {
    // Simulates refresh
  }

  public openDrawer(pluginId: string): void {
    this.activeDrawerPluginId = pluginId
  }

  public closeDrawer(): void {
    this.activeDrawerPluginId = null
  }

  public toggleDrawer(pluginId: string): void {
    if (this.activeDrawerPluginId === pluginId) {
      this.activeDrawerPluginId = null
    } else {
      this.activeDrawerPluginId = pluginId
    }
  }

  public getContextValue(): DesktopPluginHostContextValue {
    return {
      projectId: this.projectId,
      projectName: this.projectName,
      activeChapter: this.activeChapter,
      activeChapterId: this.activeChapterId,
      revision: this.revision,
      bookHierarchy: this.bookHierarchy,
      mutateActiveChapter: (patch) => this.mutateActiveChapter(patch),
      mutateCodexEntity: (id, mut) => this.mutateCodexEntity(id, mut),
      refreshBookHierarchy: () => this.refreshBookHierarchy(),
      activeDrawerPluginId: this.activeDrawerPluginId,
      openDrawer: (id) => this.openDrawer(id),
      closeDrawer: () => this.closeDrawer(),
      toggleDrawer: (id) => this.toggleDrawer(id),
    }
  }
}

export function getDirectIdbHandle(): typeof db {
  return db
}
