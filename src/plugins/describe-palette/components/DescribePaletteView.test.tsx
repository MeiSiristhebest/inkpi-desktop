import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DescribePaletteView } from './DescribePaletteView'
import { describePaletteEngine } from '../engine/DescribePaletteEngine'
describe('Description workspace constraints', () => {
  it('retains a no-match query through random selection', () => {
    render(<DescribePaletteView projectId="p" />)
    fireEvent.change(screen.getByLabelText('描写素材检索'), {
      target: { value: '确实不存在的合成对象9876' },
    })
    expect(screen.queryByRole('button', { name: '复制此句' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '按筛选抽取素材' }))
    expect(screen.queryByRole('button', { name: '复制此句' })).not.toBeInTheDocument()
  })
  it('passes actual author filters and query to the bounded sampler', () => {
    const sample = vi.spyOn(describePaletteEngine, 'inspireRandom')
    render(<DescribePaletteView projectId="p" />)
    fireEvent.change(screen.getByLabelText('描写素材检索'), { target: { value: '剑芒' } })
    fireEvent.click(screen.getByRole('button', { name: '按筛选抽取素材' }))
    expect(sample).toHaveBeenCalledWith('all', undefined, 3, undefined, '剑芒')
    sample.mockRestore()
  })
  it('counts Unicode text and shows exact source instead of a quality verdict', () => {
    render(<DescribePaletteView projectId="p" />)
    fireEvent.change(screen.getByLabelText('待定位描写正文'), { target: { value: '😀光' } })
    expect(screen.getByText(/2 个非空白 Unicode 字符/)).toBeInTheDocument()
    expect(screen.getByText(/视觉词项 \[2, 3\)/)).toBeInTheDocument()
  })
})
