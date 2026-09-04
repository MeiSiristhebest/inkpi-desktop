import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FactionMatrixMasterView } from './FactionMatrixMasterView'

vi.mock('../../../adapters/indexedDbFactionDiplomacyRepository', () => ({
  indexedDbFactionDiplomacyRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'f1', name: '玄剑宗', category: 'faction', projectId: 'p1' },
      { id: 'f2', name: '血煞门', category: 'faction', projectId: 'p1' },
    ]),
  },
}))

describe('FactionMatrixMasterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading, faction reputation cards and diplomacy matrix', async () => {
    render(<FactionMatrixMasterView projectId="p1" />)
    expect(screen.getByText('势力声望与宗门地缘沙盘')).toBeDefined()
    expect(screen.getByText(/主角全宗门声望天平/)).toBeDefined()
    await waitFor(() => {
      expect(screen.getAllByText('玄剑宗').length).toBeGreaterThan(0)
    })
  })

  it('triggers event ripple simulation upon clicking button', async () => {
    render(<FactionMatrixMasterView projectId="p1" />)
    await waitFor(() => {
      expect(screen.getAllByText('玄剑宗').length).toBeGreaterThan(0)
    })
    const btn = screen.getByText('模拟涟漪影响')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/连锁反应推演分析/)).toBeDefined()
    })
  })
})
