import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SceneBeatsMasterView } from './SceneBeatsMasterView'
import { indexedDbSceneBeatRepository as repo } from '../../../adapters/indexedDbSceneBeatRepository'
vi.mock('../../../adapters/indexedDbSceneBeatRepository', () => ({
  indexedDbSceneBeatRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'c',
        projectId: 'p',
        volumeId: 'v',
        title: '保存章',
        order: 0,
        content: '实际正文。',
        revision: 1,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p', order: 0 }]),
  },
}))
describe('Scene author planning', () => {
  it('creates unfilled drafts bound to the selected saved chapter', async () => {
    render(<SceneBeatsMasterView projectId="p" />)
    await screen.findAllByText(/保存章/)
    fireEvent.click(screen.getByRole('button', { name: '新建目标与选择模板' }))
    expect(screen.getByLabelText('节拍目标或冲突 0')).toHaveValue('')
    expect(screen.getByLabelText('细纲总字符预算')).toHaveValue(null)
    fireEvent.change(screen.getByLabelText('细纲总字符预算'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('节拍目标或冲突 0'), {
      target: { value: '找出信件来源' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存作者细纲' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          chapterId: 'c',
          targetWordCount: 100,
          beats: expect.arrayContaining([
            expect.objectContaining({ goalOrConflict: '找出信件来源' }),
          ]),
        }),
      ),
    )
  })
  it('refuses invalid shares without saving or altering the draft', async () => {
    vi.mocked(repo.save).mockClear()
    render(<SceneBeatsMasterView projectId="p" />)
    await screen.findAllByText(/保存章/)
    fireEvent.click(screen.getByRole('button', { name: '新建目标与选择模板' }))
    fireEvent.change(screen.getByLabelText('细纲总字符预算'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('节拍预算占比 0'), { target: { value: '0.8' } })
    fireEvent.click(screen.getByRole('button', { name: '保存作者细纲' }))
    await screen.findByRole('alert')
    expect(repo.save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('节拍预算占比 0')).toHaveValue(0.8)
  })
  it('keeps edits made after the save started', async () => {
    let complete!: () => void
    vi.mocked(repo.save).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve
        }),
    )
    render(<SceneBeatsMasterView projectId="p" />)
    await screen.findAllByText(/保存章/)
    fireEvent.click(screen.getByRole('button', { name: '新建目标与选择模板' }))
    fireEvent.change(screen.getByLabelText('细纲总字符预算'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('节拍目标或冲突 0'), { target: { value: '先前目标' } })
    fireEvent.click(screen.getByRole('button', { name: '保存作者细纲' }))
    await waitFor(() => expect(typeof complete).toBe('function'))
    fireEvent.change(screen.getByLabelText('节拍目标或冲突 0'), { target: { value: '后续目标' } })
    await act(async () => complete())
    expect(screen.getByLabelText('节拍目标或冲突 0')).toHaveValue('后续目标')
    expect(screen.getByRole('status')).toHaveTextContent('后续编辑仍未保存')
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0].beats[0].goalOrConflict).toBe('先前目标')
  })
})
