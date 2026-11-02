import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
        volumeId: 'volume-1',
        title: '第一章 圣母降临与压级屈辱',
        content: '主角跪在地上求饶，被反派各种嘲讽。他原谅了他。自断经脉，沦为废人。',
        order: 1,
        revision: 7,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([
      { id: 'volume-1', projectId: 'proj-1', title: '第一卷', order: 1 },
      { id: 'volume-2', projectId: 'proj-1', title: '第二卷', order: 2 },
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

  it('renders source questions and saves without scores or invented votes', async () => {
    render(<ReaderSimulatorMasterView projectId="proj-1" />)

    expect(screen.getByText(/读者视角复核/)).toBeInTheDocument()
    expect(screen.getByText(/AI 输出是基于设定画像的模拟，不代表真实读者反馈/)).toBeInTheDocument()
    expect(screen.getByText(/留存、转化、订阅或销售数据/)).toBeInTheDocument()
    expect(screen.queryByText(/真实读者拟真反应/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/第一章 圣母降临与压级屈辱/)).toBeInTheDocument()
      expect(screen.getByText(/本地定位到 2 类词项复核问题/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存复核问题')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('已保存当前章复核问题快照')).toBeInTheDocument()
    })
    const record = vi.mocked(indexedDbReaderSimulationRepository.save).mock.calls[0][0]
    expect(record).not.toHaveProperty('toxicityScore')
    expect(record.sourceRevision).toBe(7)
    expect(
      record.comments.every(
        (comment) => comment.sentiment === 'review_question' && comment.upvotes === undefined,
      ),
    ).toBe(true)
    expect(screen.getByRole('region', { name: '已保存的复核快照' })).toHaveTextContent(
      '来源保存修订 7',
    )
    expect(screen.getByRole('region', { name: '已保存的复核快照' })).toHaveTextContent(
      '第一章 圣母降临与压级屈辱',
    )
  })

  it('uses whole-project chapter numbers across volumes in saved review snapshots', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      {
        id: 'chap-1',
        projectId: 'proj-1',
        volumeId: 'volume-1',
        title: '第一卷第一章',
        content: '角色跪下。',
        order: 0,
        revision: 2,
      },
      {
        id: 'chap-2',
        projectId: 'proj-1',
        volumeId: 'volume-1',
        title: '第一卷第二章',
        content: '其他内容。',
        order: 1,
        revision: 3,
      },
      {
        id: 'chap-3',
        projectId: 'proj-1',
        volumeId: 'volume-2',
        title: '第二卷第一章',
        content: '角色跪下。',
        order: 0,
        revision: 4,
      },
    ] as any)
    render(<ReaderSimulatorMasterView projectId="proj-1" />)

    await userEvent.click(await screen.findByRole('combobox', { name: '预演章节' }))
    await userEvent.click(await screen.findByRole('option', { name: '第 3 章：第二卷第一章' }))
    fireEvent.click(screen.getByRole('button', { name: '保存复核问题' }))

    await waitFor(() => expect(indexedDbReaderSimulationRepository.save).toHaveBeenCalled())
    expect(indexedDbReaderSimulationRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterId: 'chap-3', chapterOrder: 3 }),
    )
  })

  it('renders source questions without a safety or toxicity verdict', () => {
    render(
      <ReaderSimulatorDrawer
        projectId="proj-1"
        currentText="反派逼迫主角跪下磕头，受尽屈辱，主角竟然原谅了他！"
      />,
    )

    expect(screen.getByText(/读者视角复核/)).toBeInTheDocument()
    expect(screen.getByText(/原文复核问题/)).toBeInTheDocument()
    expect(screen.queryByText(/发现敏感毒点|退订风险|点赞:/)).not.toBeInTheDocument()
  })
})
