import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ReaderSimulatorMasterView } from './ReaderSimulatorMasterView'
import { ReaderSimulatorDrawer } from './ReaderSimulatorDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbReaderSimulationRepository } from '../../../adapters/indexedDbReaderSimulationRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'chap-1',
        projectId: 'proj-1',
        title: '第一章 圣母降临与压级屈辱',
        content: '主角跪在地上求饶，被反派各种嘲讽。他原谅了他。自断经脉，沦为废人。',
        order: 1,
      },
    ]),
  },
}))

vi.mock('../../../adapters/indexedDbReaderSimulationRepository', () => ({
  indexedDbReaderSimulationRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    getByChapterId: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ReaderSimulator Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ReaderSimulatorMasterView and detects toxic alert', async () => {
    render(<ReaderSimulatorMasterView projectId="proj-1" />)

    expect(screen.getByText(/读者认知镜像与段评预演沙盒/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/第一章 圣母降临与压级屈辱/)).toBeInTheDocument()
      expect(screen.getByText(/读者毒发弃书高危警示/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存评估')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('已保存当前章读者镜像沙盘评估')).toBeInTheDocument()
    })
  })

  it('renders ReaderSimulatorDrawer with live toxicity preview', () => {
    render(
      <ReaderSimulatorDrawer
        projectId="proj-1"
        currentText="反派逼迫主角跪下磕头，受尽屈辱，主角竟然原谅了他！"
      />
    )

    expect(screen.getByText(/读者心智段评随动/)).toBeInTheDocument()
    expect(screen.getByText(/发现敏感毒点/)).toBeInTheDocument()
    expect(screen.getByText(/段评\/本章说弹幕预演/)).toBeInTheDocument()
  })
})
