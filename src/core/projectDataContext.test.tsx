import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ProjectDataProvider, useProjectData } from './projectDataContext'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import type { FC, ReactNode } from 'react'

vi.mock('../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getProject: vi.fn(),
    getChaptersByProject: vi.fn(),
    getVolumesByProject: vi.fn(),
  },
}))

describe('ProjectDataProvider', () => {
  it('loads project data and caches properly', async () => {
    vi.mocked(indexedDbProjectRepository.getProject).mockResolvedValue({
      id: 'test-p1',
      title: '测试作品',
      status: 'writing',
      createdAt: 1000,
      updatedAt: 2000,
    })
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      {
        id: 'c-1',
        projectId: 'test-p1',
        title: '第一章',
        order: 1,
        content: '正文内容',
        createdAt: 1000,
        updatedAt: 2000,
      },
    ])
    vi.mocked(indexedDbProjectRepository.getVolumesByProject).mockResolvedValue([])

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <ProjectDataProvider projectId="test-p1">{children}</ProjectDataProvider>
    )

    const { result } = renderHook(() => useProjectData(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.project?.title).toBe('测试作品')
    expect(result.current.chapters.length).toBe(1)
  })
})
