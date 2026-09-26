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
} from '../core/projectService'
import type { NewProjectForm } from '../domain/project/projectDefaults'
import type { ProjectRecord } from '../types'

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
  createDemo: () => Promise<void>
  /** 完整工作区备份（含设定/时间线/插件/AI 数据） */
  exportProject: (id: string) => Promise<void>
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
    if (!result.ok) return
    setProjects((prev) => [result.project, ...prev])
    setActiveProjectId(result.project.id)
  }, [])

  const handleCreateDemo = useCallback(async () => {
    const project = await createDemoProject()
    setProjects((prev) => [project, ...prev])
    setActiveProjectId(project.id)
  }, [])

  const handleExportProject = useCallback(async (id: string) => {
    await exportProject(id)
  }, [])

  const handleExportManuscript = useCallback(async (id: string) => {
    await exportManuscript(id)
  }, [])

  const handleUpdateProject = useCallback(async (project: ProjectRecord) => {
    await updateProject(project)
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)))
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
    createDemo: handleCreateDemo,
    exportProject: handleExportProject,
    exportManuscript: handleExportManuscript,
    updateProject: handleUpdateProject,
    deleteProject: handleDeleteProject,
    removeFromLibrary: handleRemoveFromLibrary,
    restoreToLibrary: handleRestoreToLibrary,
  }
}
