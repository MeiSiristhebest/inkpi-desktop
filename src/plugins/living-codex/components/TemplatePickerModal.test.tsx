import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplatePickerModal } from './TemplatePickerModal'
import { CHARACTER_PRESETS, WORLD_TEMPLATE_PRESETS } from '../content/characterPresets'

describe('TemplatePickerModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <TemplatePickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders character presets list when open and allows gender filtering', () => {
    render(<TemplatePickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)
    // §P2.5：对外报出的模板条数必须由数据源算出来，以前这里手写的是「36+」。
    const realTemplateCount = CHARACTER_PRESETS.length + WORLD_TEMPLATE_PRESETS.length
    expect(screen.getByText(new RegExp(`${realTemplateCount} 款预置模板`))).toBeInTheDocument()
    expect(screen.getAllByText('优雅贵气型').length).toBeGreaterThan(0)

    // 切换男性人设筛选
    const maleFilter = screen.getByRole('button', { name: '男性人设' })
    fireEvent.click(maleFilter)

    expect(screen.getAllByText('高冷禁欲型').length).toBeGreaterThan(0)
    expect(screen.queryByText('优雅贵气型')).not.toBeInTheDocument()
  })

  it('fills the current form and closes when selecting a character preset', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(<TemplatePickerModal isOpen={true} onClose={onClose} onSelect={onSelect} />)
    // §P2.15：这里只把模板灌进当前表单，动词不能借用「应用/套用」，否则和真正落库的入口就分不开了。
    expect(screen.getByText(/选择时不会写入设定库/)).toBeInTheDocument()
    const fillFormBtn = screen.getByRole('button', { name: /填入当前设定表单/ })
    fireEvent.click(fillFormBtn)

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'character',
        summary: expect.stringContaining('世家贵胄'),
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders every world template card on its own tab', () => {
    render(<TemplatePickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />)

    const tabs = [
      ['势力宗门模版', 'faction'],
      ['神兵法宝模版', 'item'],
      ['地理禁地模版', 'location'],
    ] as const

    // 模板改成从 WORLD_TEMPLATE_PRESETS 渲染：卡片漏一份、或者串到别的分类页，这里就得红。
    for (const [tabLabel, category] of tabs) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(tabLabel) }))
      for (const preset of WORLD_TEMPLATE_PRESETS.filter((t) => t.category === category)) {
        expect(screen.getByText(preset.heading)).toBeInTheDocument()
      }
      for (const other of WORLD_TEMPLATE_PRESETS.filter((t) => t.category !== category)) {
        expect(screen.queryByText(other.heading)).not.toBeInTheDocument()
      }
    }
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
      }),
    )
  })
})
