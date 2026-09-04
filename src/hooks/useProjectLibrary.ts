import { useState, useEffect, useCallback } from 'react'
import {
  loadProjects,
  createProject,
  importProject,
  createDemoProject,
  exportProject,
  deleteProject,
  updateProject,
} from '../core/projectService'
import type { ProjectRecord } from '../types'

/**
 * 项目书架编排（§7.3，从 App.tsx 组合根抽离）。
 *
 * 仅负责项目 CRUD 的状态聚合与命令转发，持久化与迁移全部委托给 core/projectService
 * （依赖倒置，不触碰 db 单例）。App.tsx 作为组合根把本 hook 输出接到 <Bookshelf>。
 */
export interface ProjectLibrary {
  projects: ProjectRecord[]
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  createProject: (name: string, genre: string, intro: string) => Promise<void>
  importProject: (file: File) => Promise<void>
  createDemo: () => Promise<void>
  exportProject: (id: string) => Promise<void>
  updateProject: (project: ProjectRecord) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export function useProjectLibrary(): ProjectLibrary {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects().then((list) => setProjects(list))
  }, [])

  const handleCreateProject = useCallback(async (name: string, genre: string, intro: string) => {
    const project = await createProject(name, genre, intro)
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

  const handleUpdateProject = useCallback(async (project: ProjectRecord) => {
    await updateProject(project)
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)))
  }, [])

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (activeProjectId === id) setActiveProjectId(null)
    },
    [activeProjectId],
  )

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject: handleCreateProject,
    importProject: handleImportProject,
    createDemo: handleCreateDemo,
    exportProject: handleExportProject,
    updateProject: handleUpdateProject,
    deleteProject: handleDeleteProject,
  }
}
