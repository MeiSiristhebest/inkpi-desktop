import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClueWeaverMasterView } from './ClueWeaverMasterView'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([]),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p1', order: 0 }]),
  },
}))

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

  it('does not invent characters or scan sample text when the project has no characters', async () => {
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValueOnce([])
    render(<ClueWeaverMasterView projectId="p1" />)

    await waitFor(() => {
      expect(screen.getByText(/请先在活体世界观中添加角色/)).toBeInTheDocument()
    })
    expect(screen.queryByText('陆沉')).not.toBeInTheDocument()
    expect(screen.queryByText('林夕')).not.toBeInTheDocument()
    expect(screen.getByText('输入正文或选择章节后开始扫描。')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/自动从所选章节同步/)).toHaveValue('')
    expect(screen.queryByText(/【全知泄露】/)).not.toBeInTheDocument()
  })
  it('scans all chapters at their own acquisition time and discards old text results', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValueOnce([
      {
        id: 'early',
        volumeId: 'v',
        projectId: 'p1',
        title: '早',
        order: 0,
        content: '林夕说道：“中毒。”',
        revision: 1,
      },
      {
        id: 'late',
        volumeId: 'v',
        projectId: 'p1',
        title: '晚',
        order: 4,
        content: '林夕说道：“中毒。”',
        revision: 1,
      },
      ...[1, 2, 3].map((order) => ({
        id: `middle-${order}`,
        volumeId: 'v',
        projectId: 'p1',
        title: '中段',
        order,
        content: '',
        revision: 1,
      })),
    ] as any)
    vi.mocked(indexedDbClueWeaverRepository.getAllCognitions).mockResolvedValueOnce([
      {
        id: 'k',
        projectId: 'p1',
        characterId: 'char-2',
        characterName: '林夕',
        clueId: 'c1',
        epistemicState: 'known',
        learnedAtChapter: 3,
        notes: '听到证词',
        updatedAt: 1,
      },
    ])
    render(<ClueWeaverMasterView projectId="p1" />)
    const text = screen.getByPlaceholderText(/自动从所选章节同步/)
    await waitFor(() =>
      expect(text).toHaveValue(
        ['林夕说道：“中毒。”', '', '', '', '林夕说道：“中毒。”'].join('\n\n'),
      ),
    )
    fireEvent.click(screen.getByText('规则扫描'))
    expect(screen.getAllByText(/待复核：林夕/)).toHaveLength(1)
    expect(screen.getByText(/第 1 章；原文/)).toHaveTextContent('中毒')
    fireEvent.change(text, { target: { value: '新的手动正文' } })
    expect(screen.queryByText(/待复核：林夕/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('片段所属章节')).toBeInTheDocument()
  })
})
