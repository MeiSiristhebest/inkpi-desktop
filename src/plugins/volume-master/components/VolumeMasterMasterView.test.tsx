import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VolumeMasterMasterView } from './VolumeMasterMasterView'
import { indexedDbVolumeArcRepository as repo } from '../../../adapters/indexedDbVolumeArcRepository'
vi.mock('../../../adapters/indexedDbVolumeArcRepository', () => ({
  indexedDbVolumeArcRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbEmotionAuditRepository', () => ({
  indexedDbEmotionAuditRepository: { getAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getVolumesByProject: vi
      .fn()
      .mockResolvedValue([{ id: 'v', projectId: 'p', title: '保存卷', order: 0 }]),
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'c',
        projectId: 'p',
        volumeId: 'v',
        order: 0,
        content: '😀正文',
        revision: 1,
        wordCount: 9999,
      },
    ]),
  },
}))
describe('Actual volume planning', () => {
  it('counts saved content instead of trusting a stale count cache', async () => {
    render(<VolumeMasterMasterView projectId="p" />)
    await screen.findByText(/保存稿 3 字符/)
    expect(screen.getByLabelText('分卷字符预算')).toHaveValue(null)
    expect(screen.getByText(/尚未全部填写/)).toBeInTheDocument()
  })
  it('saves only explicit budgets and keeps a failed form for retry', async () => {
    vi.mocked(repo.save).mockRejectedValueOnce(new Error('store failed'))
    render(<VolumeMasterMasterView projectId="p" />)
    await screen.findByText(/保存稿 3 字符/)
    fireEvent.change(screen.getByLabelText('分卷字符预算'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('分卷目标与冲突'), { target: { value: '查清事件' } })
    fireEvent.click(screen.getByRole('button', { name: '保存分卷规划' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('分卷目标与冲突')).toHaveValue('查清事件')
    fireEvent.click(screen.getByRole('button', { name: '保存分卷规划' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('规划已保存'))
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'p',
        volumeId: 'v',
        targetWordCount: 200,
        coreConflict: '查清事件',
        isCompleted: false,
        actStage: undefined,
      }),
    )
  })
  it('retains new budget input while an earlier snapshot finishes saving', async () => {
    let complete!: () => void
    vi.mocked(repo.save).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve
        }),
    )
    render(<VolumeMasterMasterView projectId="p" />)
    await screen.findByText(/保存稿 3 字符/)
    fireEvent.change(screen.getByLabelText('分卷字符预算'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: '保存分卷规划' }))
    await waitFor(() => expect(typeof complete).toBe('function'))
    fireEvent.change(screen.getByLabelText('分卷字符预算'), { target: { value: '201' } })
    await act(async () => complete())
    expect(screen.getByLabelText('分卷字符预算')).toHaveValue(201)
    expect(screen.getByRole('status')).toHaveTextContent('后续编辑仍未保存')
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0].targetWordCount).toBe(200)
  })
})
