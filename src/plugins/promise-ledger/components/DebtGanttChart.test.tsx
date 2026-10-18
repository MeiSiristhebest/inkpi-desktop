import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DebtGanttChart } from './DebtGanttChart'
import type { PromiseLedgerEntry } from '../types'

const entry: PromiseLedgerEntry = {
  id: 'unknown',
  projectId: 'p1',
  clueName: '待定位玉佩',
  tier: 'side_arc',
  plantChapter: 0,
  softDeadline: 0,
  dueChapterLimit: 0,
  plantNote: '',
  status: 'planted',
  memoryDecayLambda: 0.05,
  progressHistory: [],
  relatedEntityIds: [],
  relatedChapterIds: [],
  createdAt: 1,
  updatedAt: 1,
}

describe('DebtGanttChart unknown placement', () => {
  it('keeps an unplaced promise selectable without drawing a deadline bar or heat', () => {
    const onSelectEntry = vi.fn()
    const { container } = render(
      <DebtGanttChart entries={[entry]} currentChapter={50} onSelectEntry={onSelectEntry} />,
    )
    expect(screen.getByText('未指定章节')).toBeInTheDocument()
    expect(screen.getByText('期限未知')).toBeInTheDocument()
    expect(container.querySelector('.border-l-2')).toBeNull()
    fireEvent.click(screen.getByText('待定位玉佩'))
    expect(onSelectEntry).toHaveBeenCalledWith(entry)
  })

  it('does not draw an overdue bar when the author has not set a deadline', () => {
    const { container } = render(
      <DebtGanttChart entries={[{ ...entry, plantChapter: 2 }]} currentChapter={50} />,
    )
    expect(screen.getByText('未设置期限')).toBeInTheDocument()
    expect(container.querySelector('.border-l-2')).toBeNull()
    expect(screen.queryByText(/已超期/)).not.toBeInTheDocument()
  })
})
