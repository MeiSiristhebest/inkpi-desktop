import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExpectationMasterView } from './ExpectationMasterView'
import { indexedDbExpectationRepository } from '../../../adapters/indexedDbExpectationRepository'

describe('ExpectationMasterView — 爽点与期待感调度器主视口', () => {
  beforeEach(async () => {
    const all = await indexedDbExpectationRepository.getAll()
    await Promise.all(all.map((c) => indexedDbExpectationRepository.delete(c.id)))
  })

  it('renders header, stats, and empty state', async () => {
    render(<ExpectationMasterView projectId="p1" />)
    expect(await screen.findByText('爽点与期待感调度器')).toBeInTheDocument()
    expect(screen.getByText('爽点契约总数')).toBeInTheDocument()
    expect(screen.getByText('黄金三章追读体检')).toBeInTheDocument()
  })

  it('allows registering a new expectation contract', async () => {
    render(<ExpectationMasterView projectId="p1" />)
    const input = await screen.findByPlaceholderText(/登记新爽点契约/)
    fireEvent.change(input, { target: { value: '外门大比翻盘打脸' } })

    const addBtn = screen.getByText('登记契约')
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('外门大比翻盘打脸')).toBeInTheDocument()
    })
  })

  it('runs golden three audit when expanded', async () => {
    render(<ExpectationMasterView projectId="p1" />)
    const toggleBtn = screen.getByText('黄金三章追读体检')
    fireEvent.click(toggleBtn)

    expect(screen.getByText('黄金三章自动化节奏体检')).toBeInTheDocument()
    const runBtn = screen.getByText('运行体检')
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(screen.getByText(/体检综合评分/)).toBeInTheDocument()
    })
  })
})
