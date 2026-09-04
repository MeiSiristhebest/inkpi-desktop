import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryPalaceMasterView } from './MemoryPalaceMasterView'
import { MemoryPalaceDrawer } from './MemoryPalaceDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn(),
  },
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

describe('MemoryPalace Components', () => {
  const fakeEntities = [
    {
      id: 'e-1',
      projectId: 'proj-1',
      name: '镇魔钟',
      category: 'item',
      aliases: ['古钟'],
      summary: '敲响可镇压万魔',
      createdAt: 1,
      updatedAt: 1,
    },
  ]

  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '古刹听钟',
      order: 1,
      content: '陆沉手握古钟，感受到了镇魔钟的磅礴灵力。',
    },
  ]

  it('renders MemoryPalaceMasterView and searches entities', async () => {
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(fakeChapters as any)

    render(<MemoryPalaceMasterView projectId="proj-1" />)
    expect(screen.getByText(/记忆宫殿与历史实体快速召回仪/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('镇魔钟').length).toBeGreaterThan(0)
    })
  })

  it('renders MemoryPalaceDrawer with detected entities', async () => {
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    render(
      <MemoryPalaceDrawer
        projectId="proj-1"
        currentText="古刹之中，镇魔钟鸣响不绝。"
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/本章登场实体速查/)).toBeInTheDocument()
      expect(screen.getByText(/镇魔钟/)).toBeInTheDocument()
    })
  })
})
