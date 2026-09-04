import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DescribePaletteDrawer } from './DescribePaletteDrawer'
import { clipboardWriter } from '../../../adapters/clipboardWriter'

describe('DescribePaletteDrawer — 修辞调色盘随动抽屉', () => {
  it('renders drawer header and default items', () => {
    render(<DescribePaletteDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('修辞微观调色盘')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/搜索修辞关键词/)).toBeInTheDocument()
  })

  it('displays sensory deficit warning when text lacks senses', () => {
    // 纯视觉文本，缺少嗅觉/味觉/触觉
    const visualText = '白色的光芒照耀着黑色的阴影，少年眸子明亮，望着远方的青色残霞。'
    render(<DescribePaletteDrawer projectId="p1" currentText={visualText} />)

    expect(screen.getByText(/近 300 字感官缺失提示/)).toBeInTheDocument()
  })

  it('searches and copies snippets', () => {
    const copySpy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue()
    render(<DescribePaletteDrawer projectId="p1" currentText="" />)

    const searchInput = screen.getByPlaceholderText(/搜索修辞关键词/)
    fireEvent.change(searchInput, { target: { value: '剑芒' } })

    const copyBtn = screen.getAllByTitle('复制此句')[0]
    fireEvent.click(copyBtn)

    expect(copySpy).toHaveBeenCalled()
    copySpy.mockRestore()
  })
})
