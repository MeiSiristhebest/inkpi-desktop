import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplatePickerModal } from './TemplatePickerModal'

describe('TemplatePickerModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <TemplatePickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders character presets list when open and allows gender filtering', () => {
    render(<TemplatePickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText(/36\+ 款预置模板/)).toBeInTheDocument()
    expect(screen.getAllByText('优雅贵气型').length).toBeGreaterThan(0)

    // 切换男性人设筛选
    const maleFilter = screen.getByRole('button', { name: '男性人设' })
    fireEvent.click(maleFilter)

    expect(screen.getAllByText('高冷禁欲型').length).toBeGreaterThan(0)
    expect(screen.queryByText('优雅贵气型')).not.toBeInTheDocument()
  })

  it('calls onSelect and onClose when applying a character preset', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(<TemplatePickerModal isOpen={true} onClose={onClose} onSelect={onSelect} />)
    const applyBtn = screen.getByRole('button', { name: /一键套用此人设/ })
    fireEvent.click(applyBtn)

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'character',
        summary: expect.stringContaining('世家贵胄'),
      })
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('switches to faction and item tabs and applies templates', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(<TemplatePickerModal isOpen={true} onClose={onClose} onSelect={onSelect} />)

    // 点击势力宗门模版
    fireEvent.click(screen.getByRole('button', { name: /势力宗门模版/ }))
    expect(screen.getByText(/隐世仙门/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/隐世仙门/))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'faction',
      })
    )
  })
})
