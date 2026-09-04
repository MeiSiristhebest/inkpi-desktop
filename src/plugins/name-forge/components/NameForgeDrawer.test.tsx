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

    const rerollBtn = screen.getByTitle('重新生成 5 个名字')
    fireEvent.click(rerollBtn)
  })

  it('copies name on click', () => {
    const copySpy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue()
    render(<NameForgeDrawer projectId="p1" currentText="" />)

    const copyButtons = screen.getAllByTitle('复制名称')
    fireEvent.click(copyButtons[0])

    expect(copySpy).toHaveBeenCalled()
    copySpy.mockRestore()
  })
})
