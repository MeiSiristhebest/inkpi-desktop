import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReaderHookMasterView } from './ReaderHookMasterView'
import { indexedDbReaderHookRepository as repo } from '../../../adapters/indexedDbReaderHookRepository'
vi.mock('../../../adapters/indexedDbReaderHookRepository', () => ({
  indexedDbReaderHookRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([]),
    getVolumesByProject: vi.fn().mockResolvedValue([]),
  },
}))
describe('ReaderHookMasterView', () => {
  beforeEach(() => vi.clearAllMocks())
  it('starts without fabricated sample text', () => {
    render(<ReaderHookMasterView projectId="p" />)
    expect(screen.getByLabelText('待审章节正文')).toHaveValue('')
    expect(screen.getByRole('button', { name: '入库本章断章' })).toBeDisabled()
  })
  it('preserves source and exposes failed save before retry', async () => {
    vi.mocked(repo.save).mockRejectedValueOnce(new Error('storage failed'))
    render(<ReaderHookMasterView projectId="p" />)
    const text = screen.getByLabelText('待审章节正文')
    fireEvent.change(text, { target: { value: '😀她没有倒计时。' } })
    fireEvent.click(screen.getByRole('button', { name: '入库本章断章' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('storage failed'))
    expect(text).toHaveValue('😀她没有倒计时。')
    fireEvent.click(screen.getByRole('button', { name: '入库本章断章' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'))
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'p',
        hookText: '😀她没有倒计时。',
        hookType: 'unclassified',
      }),
    )
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0]).not.toHaveProperty('tensionScore')
  })
})
