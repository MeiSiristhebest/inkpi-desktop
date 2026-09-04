import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReaderHookMasterView } from './ReaderHookMasterView'
import { indexedDbReaderHookRepository } from '../../../adapters/indexedDbReaderHookRepository'

vi.mock('../../../adapters/indexedDbReaderHookRepository', () => ({
  indexedDbReaderHookRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../adapters/clipboardWriter', () => ({
  clipboardWriter: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ReaderHookMasterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading, tension index score, and paradigm templates', () => {
    render(<ReaderHookMasterView projectId="p1" />)
    expect(screen.getByText('断章钩子与追读率工坊')).toBeDefined()
    expect(screen.getByText(/Zeigarnik 效应/)).toBeDefined()
    expect(screen.getByText(/网文 6 大高张力断章范式/)).toBeDefined()
  })

  it('allows recalculating CTI tension score on button click', () => {
    render(<ReaderHookMasterView projectId="p1" />)
    const btn = screen.getByText('测算 CTI 张力')
    fireEvent.click(btn)
    expect(screen.getByText(/断章张力指数/)).toBeDefined()
  })

  it('saves new hook into repository', async () => {
    render(<ReaderHookMasterView projectId="p1" />)
    const saveBtn = screen.getByText('入库本章断章')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(indexedDbReaderHookRepository.save).toHaveBeenCalled()
    })
  })
})
