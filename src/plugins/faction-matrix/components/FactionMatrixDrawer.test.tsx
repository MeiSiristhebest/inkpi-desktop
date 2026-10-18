import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FactionMatrixDrawer } from './FactionMatrixDrawer'
import { indexedDbCodexEntityRepository as repo } from '../../../adapters/indexedDbCodexEntityRepository'
vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: { getAll: vi.fn() },
}))
vi.mock('../../../adapters/indexedDbFactionDiplomacyRepository', () => ({
  indexedDbFactionDiplomacyRepository: { getAll: vi.fn().mockResolvedValue([]) },
}))
describe('Faction drawer', () => {
  beforeEach(() => vi.mocked(repo.getAll).mockReset())
  it('shows actual absence without creating factions', async () => {
    vi.mocked(repo.getAll).mockResolvedValue([])
    render(<FactionMatrixDrawer projectId="p" currentText="" />)
    await screen.findByText('设定库里还没有势力条目。')
    expect(screen.queryByText('未命名势力')).not.toBeInTheDocument()
  })
  it('keeps a sole registered faction and its source value visible', async () => {
    vi.mocked(repo.getAll).mockResolvedValue([
      {
        id: 'a',
        projectId: 'p',
        name: '作者势力',
        category: 'faction',
        attributes: { reputation: 42 },
      },
    ] as any)
    render(<FactionMatrixDrawer projectId="p" currentText="" />)
    await screen.findByText('作者势力')
    expect(screen.getByText(/登记值（来源需复核） 42/)).toBeInTheDocument()
  })
  it('excludes other project records', async () => {
    vi.mocked(repo.getAll).mockResolvedValue([
      { id: 'a', projectId: 'p', name: '本作品势力', category: 'faction', attributes: {} },
      { id: 'b', projectId: 'other', name: '其他作品势力', category: 'faction', attributes: {} },
    ] as any)
    render(<FactionMatrixDrawer projectId="p" currentText="" />)
    await waitFor(() => expect(screen.getByText('本作品势力')).toBeInTheDocument())
    expect(screen.queryByText('其他作品势力')).not.toBeInTheDocument()
  })
})
