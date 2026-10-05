import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MultiCalendarMasterView } from './MultiCalendarMasterView'
import { MultiCalendarDrawer } from './MultiCalendarDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      { id: 'ch-1', projectId: 'p1', title: '启程出山', order: 1 },
      { id: 'ch-2', projectId: 'p1', title: '大乱将至', order: 2 },
    ]),
  },
}))

const authoredRecord = {
  id: 'calproj-1',
  projectId: 'p1',
  calendars: [
    {
      id: 'cal_ancient',
      name: '上古灵历',
      epochOffsetDays: 0,
      monthsPerYear: 12,
      daysPerMonth: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    },
  ],
  chronologyEvents: [],
  updatedAt: Date.now(),
}

vi.mock('../../../adapters/indexedDbMultiCalendarRepository', () => ({
  indexedDbMultiCalendarRepository: {
    get: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('MultiCalendar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(authoredRecord as any)
  })

  it('renders MultiCalendarMasterView and saves chronology', async () => {
    render(<MultiCalendarMasterView projectId="p1" />)

    expect(screen.getByText(/跨纪元多历法与故事时间轴引擎/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/平行历法双向精准换算器/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存历法时间线')
    fireEvent.click(saveBtn)
    expect(indexedDbMultiCalendarRepository.save).toHaveBeenCalled()
  })

  it('renders MultiCalendarDrawer with temporal detection', async () => {
    render(
      <MultiCalendarDrawer
        projectId="p1"
        currentText="那一年正是大炎天历三百年九月十五日，血月当空。"
      />,
    )

    expect(screen.getByText(/多历法时间轴感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/大炎天历三百年九月十五日/)).toBeInTheDocument()
    })
  })

  // §P2.4：作者什么都没配置时，插件不能替他选一套仙侠纪元。内置双历只能显式套用。
  it('starts with no calendar at all instead of the built-in cultivation era (P2.4)', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarMasterView projectId="p1" />)

    expect(await screen.findByText('本书历法体系（0 套）')).toBeInTheDocument()
    expect(screen.getByText(/尚未定义历法。这里不替你选/)).toBeInTheDocument()
    expect(screen.queryByText(/上古灵历 ·/)).not.toBeInTheDocument()
    expect(screen.queryByText(/大炎皇统历 ·/)).not.toBeInTheDocument()
    // 零节点也不能报绿色"无逻辑倒流"，那是没有依据的结论
    expect(screen.getByText(/既没有悖论，也没有/)).toBeInTheDocument()
    expect(screen.queryByText(/时间线节点单调平稳/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/套用「东方玄幻双历」预设/))
    expect(screen.getByText(/上古灵历 ·/)).toBeInTheDocument()
    expect(screen.getByText('本书历法体系（2 套）')).toBeInTheDocument()
  })

  it('converts nothing until the author defines two calendars, then converts between his own', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarMasterView projectId="p1" />)

    await screen.findByText('本书历法体系（0 套）')
    expect(screen.getByText(/至少定义两套不同的历法才能换算/)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('例如：圣历、共和历'), {
      target: { value: '圣历' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加自定义历法' }))

    expect(screen.getByText('本书历法体系（1 套）')).toBeInTheDocument()
    expect(screen.getByText(/圣历 · 12 月\/年/)).toBeInTheDocument()
    expect(screen.getByText(/至少定义两套不同的历法才能换算/)).toBeInTheDocument()
  })

  it('drawer reports an unconfigured world rather than falling back to the preset (P2.4)', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarDrawer projectId="p1" currentText="平静的一个早晨。" />)

    expect(await screen.findByText('0 套并行历法')).toBeInTheDocument()
    expect(screen.getByText(/尚未定义任何历法/)).toBeInTheDocument()
    expect(screen.queryByText(/时间线流动自检/)).not.toBeInTheDocument()
  })
})
