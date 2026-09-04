import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DescribePaletteView } from './DescribePaletteView'
import { clipboardWriter } from '../../../adapters/clipboardWriter'

describe('DescribePaletteView — 五感微观修辞调色盘主视口', () => {
  it('renders heading, tabs and default snippets', () => {
    render(<DescribePaletteView projectId="p1" />)
    expect(screen.getByText('五感微观修辞调色盘')).toBeInTheDocument()
    expect(screen.getByText('全部感官')).toBeInTheDocument()
    expect(screen.getByText('视觉 (光影)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/搜索金句/)).toBeInTheDocument()
  })

  it('filters snippets by sensory tab', () => {
    render(<DescribePaletteView projectId="p1" />)
    const soundTab = screen.getByText('听觉 (音律)')
    fireEvent.click(soundTab)

    // 应该展示听觉相关金句（如雷劫、兵刃）
    const matched = screen.getAllByText(/九天重劫|短兵相接/)
    expect(matched.length).toBeGreaterThan(0)
  })

  it('allows expanding sensory diagnostic radar and typing text', () => {
    render(<DescribePaletteView projectId="p1" />)
    const diagBtn = screen.getByText('感官雷达诊断')
    fireEvent.click(diagBtn)

    const textarea = screen.getByPlaceholderText(/残阳如血/)
    fireEvent.change(textarea, { target: { value: '白色的剑芒刺目而寒冷，雷声轰鸣震耳欲聋。' } })

    expect(screen.getByText('感官雷达透视')).toBeInTheDocument()
  })

  it('copies snippet to clipboard on click', async () => {
    const copySpy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue()
    render(<DescribePaletteView projectId="p1" />)

    const copyButtons = screen.getAllByTitle('复制金句')
    fireEvent.click(copyButtons[0])

    expect(copySpy).toHaveBeenCalled()
    copySpy.mockRestore()
  })
})
