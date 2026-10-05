import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NameForgeDrawer } from './NameForgeDrawer'
import { clipboardWriter } from '../../../adapters/clipboardWriter'

describe('NameForgeDrawer — 奇幻起名摇号随动抽屉', () => {
  it('renders drawer and generated candidates', () => {
    render(<NameForgeDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('奇幻起名摇号')).toBeInTheDocument()
    expect(screen.getByText('东方人名')).toBeInTheDocument()
    expect(screen.getByText('摇号')).toBeInTheDocument()
  })

  it('allows category switching and re-rolling', () => {
    render(<NameForgeDrawer projectId="p1" currentText="" />)
    const sectBtn = screen.getByText('宗门势力')
    fireEvent.click(sectBtn)

    // 按钮上的可见文字是「摇号」「复制」，长句只在提示里，不参与命名
    const rerollBtn = screen.getByRole('button', { name: '摇号' })
    fireEvent.click(rerollBtn)
  })

  it('copies name on click', () => {
    const copySpy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue()
    render(<NameForgeDrawer projectId="p1" currentText="" />)

    const copyButtons = screen.getAllByRole('button', { name: '复制' })
    fireEvent.click(copyButtons[0])

    expect(copySpy).toHaveBeenCalled()
    copySpy.mockRestore()
  })
})
