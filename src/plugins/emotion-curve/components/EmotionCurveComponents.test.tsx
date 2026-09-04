import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EmotionCurveMasterView } from './EmotionCurveMasterView'
import { EmotionCurveDrawer } from './EmotionCurveDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

describe('EmotionCurve Components', () => {
  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '第一章 破天',
      order: 1,
      content: '暴爽！一剑秒杀神王，全场跪伏狂笑！',
    },
  ]

  it('renders EmotionCurveMasterView with chapter evaluation cards', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(fakeChapters as any)
    render(<EmotionCurveMasterView projectId="proj-1" />)

    expect(screen.getByText(/读者情绪心电图与心智共鸣计/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/第一章 破天/)).toBeInTheDocument()
    })
  })

  it('renders EmotionCurveDrawer with polarity', async () => {
    render(
      <EmotionCurveDrawer
        projectId="proj-1"
        currentText="危机降临，杀意弥漫！"
      />
    )

    expect(screen.getByText(/读者情绪心电图/)).toBeInTheDocument()
    expect(screen.getByText(/六维情绪光谱分解/)).toBeInTheDocument()
  })
})
