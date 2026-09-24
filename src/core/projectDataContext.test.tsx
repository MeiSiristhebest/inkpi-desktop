import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ProjectDataProvider, useProjectData } from './projectDataContext'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import type { FC, ReactNode } from 'react'
import { chapterSaveEvents } from '../ports/chapterSaveEvents'

vi.mock('../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getProject: vi.fn(),
    getChaptersByProject: vi.fn(),
    getVolumesByProject: vi.fn(),
  },
}))

describe('ProjectDataProvider', () => {
  it('updates the live chapter projection after a canonical chapter save event', async () => {
    vi.mocked(indexedDbProjectRepository.getProject).mockResolvedValue({
      id: 'live-p1',
      name: '实时作品',
      createdAt: 1,
      updatedAt: 1,
    })
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      {
        id: 'live-c-1',
        projectId: 'live-p1',
        volumeId: 'live-v-1',
        title: '旧标题',
        order: 0,
        content: '',
        wordCount: 0,
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    vi.mocked(indexedDbProjectRepository.getVolumesByProject).mockResolvedValue([])

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <ProjectDataProvider projectId="live-p1">{children}</ProjectDataProvider>
    )
    const { result } = renderHook(() => useProjectData(), { wrapper })
    await waitFor(() => expect(result.current.chapters[0]?.title).toBe('旧标题'))

    chapterSaveEvents.publish({
      id: 'live-c-1',
      projectId: 'live-p1',
      volumeId: 'live-v-1',
      title: '新标题',
      order: 0,
      content: '',
      wordCount: 0,
      revision: 2,
      createdAt: 1,
      updatedAt: 2,
    })

    await waitFor(() => expect(result.current.chapters[0]?.title).toBe('新标题'))
  })

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
