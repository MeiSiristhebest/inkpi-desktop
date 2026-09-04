import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClueWeaverDrawer } from './ClueWeaverDrawer'

vi.mock('../../../adapters/indexedDbClueWeaverRepository', () => ({
  indexedDbClueWeaverRepository: {
    getAllClues: vi.fn().mockResolvedValue([
      {
        id: 'c1',
        projectId: 'p1',
        title: '魔剑秘密',
        category: 'treasure',
        keywords: ['魔剑'],
        status: 'active',
        createdAt: 100,
        updatedAt: 100,
      },
    ]),
    getAllCognitions: vi.fn().mockResolvedValue([]),
  },
}))

describe('ClueWeaverDrawer', () => {
  it('renders drawer header and triggers scan', async () => {
    render(<ClueWeaverDrawer activeChapterId="ch1" />)
    expect(screen.getByText('信息差与全知哨兵')).toBeDefined()
    const btn = screen.getByText('巡检天降全知')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/无全知泄露/)).toBeDefined()
    })
  })
})
