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

vi.mock('../../../adapters/indexedDbMultiCalendarRepository', () => ({
  indexedDbMultiCalendarRepository: {
    get: vi.fn().mockResolvedValue({
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
    }),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('MultiCalendar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      />
    )

    expect(screen.getByText(/多历法时间轴感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/大炎天历三百年九月十五日/)).toBeInTheDocument()
    })
  })
})
