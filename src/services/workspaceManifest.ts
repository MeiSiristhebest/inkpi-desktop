import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { ReferenceSourceRecord } from '../domain/references/referenceMaterials'

export const WORKSPACE_ARCHIVE_SCHEMA_VERSION = 3

export interface WorkspaceManifest {
  schemaVersion: number
  archiveType: 'inkpi-workspace-backup' | 'manuscript-export'
  workspaceId: string
  name: string
  exportedAt: number

  core: {
    project: boolean
    volumesCount: number
    chaptersCount: number
  }

  domainStoresIncluded: string[]
  /** Workspace-scoped browser keys included without global secrets. */
  localStorageKeysIncluded?: string[]
  /** Whether linked external reference texts are included in a workspace backup. */
  referenceMaterialsIncluded?: boolean
  referenceMaterialsCount?: number
  totalRecordsCount: number
}

export interface WorkspaceLocalStorageEntry {
  key: string
  value: string
}

export interface WorkspaceBackupArchive {
  manifest: WorkspaceManifest
  project: ProjectRecord
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  /**
   * Domain and plugin stores keyed by store name (e.g. codexEntities, timelineNodes, promiseLedger, etc.)
   */
  domainData: Record<string, Record<string, unknown>[]>
  /** Legacy/local browser state that is not represented in IndexedDB. */
  localStorageData?: WorkspaceLocalStorageEntry[]
  /** Globally reusable local reference sources linked to this workspace, only when explicitly included. */
  referenceSources?: ReferenceSourceRecord[]
}

export interface ManuscriptExportArchive {
  manifest: WorkspaceManifest
  project: ProjectRecord
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
}
