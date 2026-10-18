import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RhythmRadarMasterView } from './RhythmRadarMasterView'
import { RhythmRadarDrawer } from './RhythmRadarDrawer'
import { indexedDbRhythmRadarRepository as repo } from '../../../adapters/indexedDbRhythmRadarRepository'
vi.mock('../../../adapters/indexedDbRhythmRadarRepository', () => ({
  indexedDbRhythmRadarRepository: { save: vi.fn().mockResolvedValue(undefined) },
}))
describe('RhythmRadar views', () => {
  it('requires author selection and preserves the continuation on save', async () => {
    render(<RhythmRadarMasterView projectId="p" />)
    const save = screen.getByRole('button', { name: '归档当前断章雷达评测' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('断章预览正文'), {
      target: { value: '门开了。她走出去。' },
    })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: '预览此处断章' })[0])
    expect(screen.getByText('保留的后续正文')).toBeInTheDocument()
    fireEvent.click(save)
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          sourceText: '门开了。她走出去。',
          cut: expect.objectContaining({ quote: '门开了。', end: 4, continuation: '她走出去。' }),
        }),
      ),
    )
  })
  it('invalidates a selected cut when the source changes', () => {
    render(<RhythmRadarMasterView projectId="p" />)
    const editor = screen.getByLabelText('断章预览正文')
    fireEvent.change(editor, { target: { value: '第一句。下一句。' } })
    fireEvent.click(screen.getAllByRole('button', { name: '预览此处断章' })[0])
    fireEvent.change(editor, { target: { value: '新正文。' } })
    expect(screen.getByRole('button', { name: '归档当前断章雷达评测' })).toBeDisabled()
  })
  it('reports actual drawer positions', () => {
    render(<RhythmRadarDrawer projectId="p" currentText="他说：“等一下。”" />)
    expect(screen.getByText('断章位置雷达')).toBeInTheDocument()
    expect(screen.getByText(/不代表读者反馈/)).toBeInTheDocument()
  })
})
