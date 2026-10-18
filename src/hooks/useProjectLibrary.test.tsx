import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const projectService = vi.hoisted(() => ({
  loadProjects: vi.fn(),
  loadArchivedProjects: vi.fn(),
  createProject: vi.fn(),
  importProject: vi.fn(),
  createDemoProject: vi.fn(),
  exportProject: vi.fn(),
  exportManuscript: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  removeProjectFromLibrary: vi.fn(),
  restoreProjectToLibrary: vi.fn(),
}))

vi.mock('../core/projectService', () => projectService)

import { useProjectLibrary } from './useProjectLibrary'

describe('useProjectLibrary', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetAllMocks()
    projectService.loadProjects.mockResolvedValue([])
    projectService.loadArchivedProjects.mockResolvedValue([])
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('exposes backup export failures and clears them on dismissal', async () => {
    projectService.exportProject.mockRejectedValue(new Error('IndexedDB read failed'))
    const { result } = renderHook(() => useProjectLibrary())
    await waitFor(() => expect(projectService.loadProjects).toHaveBeenCalledOnce())

    await act(async () => {
      await result.current.exportProject('project-1')
    })

    expect(result.current.exportError).toBe('完整备份失败，未生成备份文件。IndexedDB read failed')
    expect(projectService.exportProject).toHaveBeenCalledWith('project-1')

    act(() => result.current.dismissExportError())

    expect(result.current.exportError).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('rejects failed import results so the shelf can show the service error', async () => {
    const file = new File(['{}'], 'broken.json', { type: 'application/json' })
    projectService.importProject.mockResolvedValueOnce({
      ok: false,
      error: 'Referential integrity violation',
    })
    const { result } = renderHook(() => useProjectLibrary())
    await waitFor(() => expect(projectService.loadProjects).toHaveBeenCalledOnce())

    await act(async () => {
      await expect(result.current.importProject(file)).rejects.toThrow(
        'Referential integrity violation',
      )
    })

    expect(projectService.importProject).toHaveBeenCalledWith(file)
    expect(result.current.projects).toEqual([])
    expect(result.current.activeProjectId).toBeNull()
  })
})
