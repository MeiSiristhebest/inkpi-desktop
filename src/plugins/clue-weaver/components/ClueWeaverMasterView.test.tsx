import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClueWeaverMasterView } from './ClueWeaverMasterView'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'

vi.mock('../../../adapters/indexedDbClueWeaverRepository', () => ({
  indexedDbClueWeaverRepository: {
    getAllClues: vi.fn().mockResolvedValue([
      {
        id: 'c1',
        projectId: 'p1',
        title: '太上长老非走火入魔乃中毒',
        category: 'murder',
        keywords: ['中毒', '九幽冥毒'],
        status: 'active',
        createdAt: 100,
        updatedAt: 100,
      },
    ]),
    saveClue: vi.fn().mockResolvedValue(undefined),
    deleteClue: vi.fn().mockResolvedValue(undefined),
    getAllCognitions: vi.fn().mockResolvedValue([]),
    saveCognition: vi.fn().mockResolvedValue(undefined),
    deleteCognition: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'char-1', name: '陆沉', category: 'character', projectId: 'p1' },
      { id: 'char-2', name: '林夕', category: 'character', projectId: 'p1' },
    ]),
  },
}))

describe('ClueWeaverMasterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, cognition matrix table and clues', async () => {
    render(<ClueWeaverMasterView projectId="p1" />)
    expect(screen.getByText('信息差与认知织机')).toBeDefined()
    expect(screen.getAllByText(/多视角认知矩阵/).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByText(/太上长老非走火入魔乃中毒/)).toBeDefined()
    })
  })

  it('allows saving a new clue', async () => {
    render(<ClueWeaverMasterView projectId="p1" />)
    const input = screen.getByPlaceholderText(/登记核心情报/)
    fireEvent.change(input, { target: { value: '禁地藏有魔剑' } })
    const addBtn = screen.getByText('登记线索')
    fireEvent.click(addBtn)
    await waitFor(() => {
      expect(indexedDbClueWeaverRepository.saveClue).toHaveBeenCalled()
    })
  })
})
