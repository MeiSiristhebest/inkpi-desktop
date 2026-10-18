import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DescribePaletteDrawer } from './DescribePaletteDrawer'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
describe('Description drawer evidence', () => {
  it('uses full current text offsets and invalidates old observations', () => {
    const { rerender } = render(<DescribePaletteDrawer projectId="p" currentText="😀没有光。" />)
    expect(screen.getByText('[4, 5)「光」')).toBeInTheDocument()
    expect(screen.queryByText(/感官缺失/)).not.toBeInTheDocument()
    rerender(<DescribePaletteDrawer projectId="p" currentText="正文。" />)
    expect(screen.queryByText(/「光」/)).not.toBeInTheDocument()
  })
  it('reports clipboard failure and permits another attempt', async () => {
    const copy = vi
      .spyOn(clipboardWriter, 'writeText')
      .mockRejectedValueOnce(new Error('clipboard failed'))
      .mockResolvedValue(undefined)
    render(<DescribePaletteDrawer projectId="p" currentText="" />)
    fireEvent.change(screen.getByLabelText('素材关键词'), { target: { value: '剑芒' } })
    fireEvent.click(screen.getAllByRole('button', { name: '复制此句' })[0])
    await screen.findByRole('alert')
    fireEvent.click(screen.getAllByRole('button', { name: '复制此句' })[0])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已复制素材'))
    copy.mockRestore()
  })
})
