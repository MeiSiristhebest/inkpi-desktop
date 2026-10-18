import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FactionMatrixMasterView } from './FactionMatrixMasterView'
import { indexedDbFactionDiplomacyRepository as repo } from '../../../adapters/indexedDbFactionDiplomacyRepository'
vi.mock('../../../adapters/indexedDbFactionDiplomacyRepository', () => ({
  indexedDbFactionDiplomacyRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'a', projectId: 'p', name: '甲势力', category: 'faction' },
      { id: 'b', projectId: 'p', name: '乙势力', category: 'faction' },
    ]),
  },
}))
describe('Faction workspace', () => {
  it('keeps missing relationships and baselines unknown', async () => {
    render(<FactionMatrixMasterView projectId="p" />)
    await screen.findAllByRole('button', { name: '未知' })
    fireEvent.change(screen.getByLabelText('直接增减假设'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: '按作者系数计算' }))
    expect(screen.getByText(/乙势力：影响未知/)).toBeInTheDocument()
    expect(screen.getAllByText(/没有作者声望数值/)).toHaveLength(2)
  })
  it('saves explicit coefficients and rationale, without fabricated reputation', async () => {
    render(<FactionMatrixMasterView projectId="p" />)
    fireEvent.click((await screen.findAllByRole('button', { name: '未知' }))[0])
    fireEvent.change(screen.getByLabelText('事件影响系数'), { target: { value: '0.25' } })
    fireEvent.change(screen.getByLabelText('影响系数适用理由'), {
      target: { value: '作者约束：仅此事件' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存作者关系' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          rippleCoefficient: 0.25,
          rippleRationale: '作者约束：仅此事件',
        }),
      ),
    )
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0]).not.toHaveProperty('reputationScore')
  })
})
