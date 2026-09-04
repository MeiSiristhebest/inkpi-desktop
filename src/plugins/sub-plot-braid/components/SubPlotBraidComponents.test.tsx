import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SubPlotBraidMasterView } from './SubPlotBraidMasterView'
import { SubPlotBraidDrawer } from './SubPlotBraidDrawer'
import { indexedDbSubPlotRepository } from '../../../adapters/indexedDbSubPlotRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbSubPlotRepository', () => ({
  indexedDbSubPlotRepository: {
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

describe('SubPlotBraid Components', () => {
  const fakeStrands = [
    {
      id: 's-1',
      projectId: 'proj-1',
      title: '排查魔教卧底',
      summary: '白长老正在暗中调查',
      status: 'active',
      involvedCharacterIds: [],
      involvedCharacterNames: ['白长老'],
      startChapterOrder: 1,
      lastActiveChapterOrder: 2,
      tags: ['卧底'],
      updatedAt: 1,
    },
  ]

  it('renders SubPlotBraidMasterView and shows strand cards', async () => {
    vi.mocked(indexedDbSubPlotRepository.getAll).mockResolvedValue(fakeStrands as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([] as any)

    render(<SubPlotBraidMasterView projectId="proj-1" />)

    expect(screen.getByText(/多线叙事编织器与副线汇聚罗盘/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/排查魔教卧底/)).toBeInTheDocument()
    })
  })

  it('renders SubPlotBraidDrawer with active detected strands', async () => {
    vi.mocked(indexedDbSubPlotRepository.getAll).mockResolvedValue(fakeStrands as any)

    render(
      <SubPlotBraidDrawer
        projectId="proj-1"
        currentText="白长老面色凝重，握紧了手中密信。"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/多线叙事随动感知/)).toBeInTheDocument()
      expect(screen.getAllByText('排查魔教卧底').length).toBeGreaterThan(0)
    })
  })
})
