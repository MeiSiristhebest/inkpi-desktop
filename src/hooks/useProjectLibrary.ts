import { useState, useEffect, useCallback } from 'react'
import {
  loadProjects,
  loadArchivedProjects,
  createProject,
  importProject,
  createDemoProject,
  exportProject,
  exportManuscript,
  deleteProject,
  updateProject,
  removeProjectFromLibrary,
  restoreProjectToLibrary,
  loadProjectVolumes as loadProjectVolumesFromService,
} from '../core/projectService'
import { importManuscript as importManuscriptService } from '../services/manuscriptImportService'
import type {
  ManuscriptImportDestination,
  ManuscriptImportProgress,
  ManuscriptImportResult,
} from '../services/manuscriptImportService'
import type { ManuscriptImportPreview } from '../domain/manuscript/importParser'
import type { NewProjectForm } from '../domain/project/projectDefaults'
import type { ProjectRecord, VolumeRecord } from '../types'
import type { ExportWorkspaceBackupOptions } from '../services/workspaceLifecycleService'

/**
 * 项目书架编排（§7.3，从 App.tsx 组合根抽离）。
 *
 * 仅负责项目 CRUD 的状态聚合与命令转发，持久化与迁移全部委托给 core/projectService
 * （依赖倒置，不触碰 db 单例）。App.tsx 作为组合根把本 hook 输出接到 <Bookshelf>。
 */
export interface ProjectLibrary {
  projects: ProjectRecord[]
  archivedProjects: ProjectRecord[]
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  createProject: (form: NewProjectForm) => Promise<void>
  importProject: (file: File) => Promise<void>
  loadProjectVolumes: (projectId: string) => Promise<VolumeRecord[]>
  importManuscript: (
    preview: ManuscriptImportPreview,
    destination: ManuscriptImportDestination,
    onProgress?: (progress: ManuscriptImportProgress) => void,
  ) => Promise<ManuscriptImportResult>
  createDemo: () => Promise<void>
  /** 完整工作区备份（含设定/时间线/插件/AI 数据） */
  exportProject: (id: string, options?: ExportWorkspaceBackupOptions) => Promise<void>
  exportError: string | null
  dismissExportError: () => void
  /** 纯正文导出，不含任何中间状态 */
  exportManuscript: (id: string) => Promise<void>
  updateProject: (project: ProjectRecord) => Promise<void>
  /** 永久删除：级联清除全部工作区数据，不可撤销 */
  deleteProject: (id: string) => Promise<void>
  /** 移出作品库：只隐藏书架条目，数据完整保留 */
  removeFromLibrary: (id: string) => Promise<void>
  /** 把已移出的作品放回书架 */
  restoreToLibrary: (id: string) => Promise<void>
}

export function useProjectLibrary(): ProjectLibrary {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [archivedProjects, setArchivedProjects] = useState<ProjectRecord[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects().then((list) => setProjects(list))
    loadArchivedProjects().then(setArchivedProjects)
  }, [])

  const refreshLibrary = useCallback(async () => {
    setProjects(await loadProjects())
    setArchivedProjects(await loadArchivedProjects())
  }, [])

  const handleCreateProject = useCallback(async (form: NewProjectForm) => {
    const project = await createProject(form)
    setProjects((prev) => [project, ...prev])
    setActiveProjectId(project.id)
  }, [])

  const handleImportProject = useCallback(async (file: File) => {
    const result = await importProject(file)
    if (!result.ok) throw new Error(result.error)
    setProjects((prev) => [result.project, ...prev])
    setActiveProjectId(result.project.id)
  }, [])

  const handleImportManuscript = useCallback(
    async (
      preview: ManuscriptImportPreview,
      destination: ManuscriptImportDestination,
      onProgress?: (progress: ManuscriptImportProgress) => void,
    ) => {
      try {
        const result = await importManuscriptService(preview, destination, onProgress, {
          createProject,
          deleteProject,
        })
        await refreshLibrary()
        return result
      } catch (error) {
        await refreshLibrary().catch(() => undefined)
        throw error
      }
    },
    [refreshLibrary],
  )

  const handleCreateDemo = useCallback(async () => {
    const project = await createDemoProject()
    setProjects((prev) => [project, ...prev])
    setActiveProjectId(project.id)
  }, [])

  const handleExportProject = useCallback(
    async (id: string, options?: ExportWorkspaceBackupOptions) => {
      setExportError(null)
      try {
        await exportProject(id, options)
      } catch (error) {
        console.warn('[InkPi Desktop] Workspace backup failed:', error)
        const message = error instanceof Error ? error.message : String(error)
        setExportError(`完整备份失败，未生成备份文件。${message}`)
      }
    },
    [],
  )

  const handleExportManuscript = useCallback(async (id: string) => {
    await exportManuscript(id)
  }, [])

  const handleUpdateProject = useCallback(async (project: ProjectRecord) => {
    const updated = await updateProject(project)
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }, [])

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setArchivedProjects((prev) => prev.filter((p) => p.id !== id))
      if (activeProjectId === id) setActiveProjectId(null)
    },
    [activeProjectId],
  )

  const handleRemoveFromLibrary = useCallback(
    async (id: string) => {
      await removeProjectFromLibrary(id)
      await refreshLibrary()
      if (activeProjectId === id) setActiveProjectId(null)
    },
    [activeProjectId, refreshLibrary],
  )

  const handleRestoreToLibrary = useCallback(
    async (id: string) => {
      await restoreProjectToLibrary(id)
      await refreshLibrary()
    },
    [refreshLibrary],
  )

  return {
    projects,
    archivedProjects,
    activeProjectId,
    setActiveProjectId,
    createProject: handleCreateProject,
    importProject: handleImportProject,
    loadProjectVolumes: loadProjectVolumesFromService,
    importManuscript: handleImportManuscript,
    createDemo: handleCreateDemo,
    exportProject: handleExportProject,
    exportError,
    dismissExportError: () => setExportError(null),
    exportManuscript: handleExportManuscript,
    updateProject: handleUpdateProject,
    deleteProject: handleDeleteProject,
    removeFromLibrary: handleRemoveFromLibrary,
    restoreToLibrary: handleRestoreToLibrary,
  }
}
