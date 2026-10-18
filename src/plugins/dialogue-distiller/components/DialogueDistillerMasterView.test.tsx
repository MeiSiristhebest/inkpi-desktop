import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DialogueDistillerMasterView } from './DialogueDistillerMasterView'
import { indexedDbDialogueVoiceprintRepository as repo } from '../../../adapters/indexedDbDialogueVoiceprintRepository'
vi.mock('../../../adapters/indexedDbDialogueVoiceprintRepository', () => ({
  indexedDbDialogueVoiceprintRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'a', projectId: 'p', category: 'character', name: '甲' },
      { id: 'b', projectId: 'p', category: 'character', name: '乙' },
    ]),
  },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([]),
    getVolumesByProject: vi.fn().mockResolvedValue([]),
  },
}))
describe('Dialogue workspace', () => {
  it('requires actual samples and binds saved measurements to source', async () => {
    render(<DialogueDistillerMasterView projectId="p" />)
    await waitFor(() => expect(screen.getByLabelText('目标角色列表')).toHaveValue('甲，乙'))
    expect(screen.getByRole('button', { name: '比对' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('待分析对白正文'), {
      target: { value: '甲说：“好？”乙说：“知道了！”' },
    })
    fireEvent.click(screen.getByRole('button', { name: '比对' }))
    expect(screen.getByText(/A 减 B：平均句长差/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存当前对白样本' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          characterName: '甲',
          sourceText: '甲说：“好？”乙说：“知道了！”',
          quoteEvidence: [expect.objectContaining({ quote: '好？' })],
        }),
      ),
    )
  })
  it('never fabricates names for an empty new project', async () => {
    render(<DialogueDistillerMasterView projectId="other" />)
    await waitFor(() => expect(screen.getByLabelText('目标角色列表')).toHaveValue(''))
    expect(screen.getByRole('button', { name: '比对' })).toBeDisabled()
  })
})
