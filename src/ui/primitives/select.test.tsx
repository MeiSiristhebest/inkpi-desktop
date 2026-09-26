import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './select'

const OPTS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'done', label: '已完成' },
]

describe('Select 门面', () => {
  it('触发器显示选项标签而不是原始 value，可访问名来自 aria-label', () => {
    render(<Select value="draft" onValueChange={vi.fn()} options={OPTS} aria-label="章节状态" />)
    expect(screen.getByRole('combobox', { name: '章节状态' })).toHaveTextContent('草稿')
  })

  it("契约：'' 一律表示未选择，显示 placeholder 而不是对应选项", () => {
    render(
      <Select
        value=""
        onValueChange={vi.fn()}
        options={OPTS}
        placeholder="请选择"
        aria-label="筛选"
      />,
    )
    const trigger = screen.getByRole('combobox', { name: '筛选' })
    expect(trigger).toHaveTextContent('请选择')
    expect(trigger).not.toHaveTextContent('全部状态')
  })

  it('原生 <option> 子节点形状与 options 数组等价，回调拿到字符串', async () => {
    const onValueChange = vi.fn()
    render(
      <Select value="18" onValueChange={onValueChange} aria-label="字号">
        <option value="16">16px</option>
        <option value="18">18px</option>
      </Select>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '字号' }))
    await userEvent.click(await screen.findByRole('option', { name: '16px' }))
    expect(onValueChange).toHaveBeenCalledWith('16')
  })

  it('选中带空串 value 的选项时，回调仍然拿到空串而不是 null', async () => {
    const onValueChange = vi.fn()
    render(<Select value="draft" onValueChange={onValueChange} options={OPTS} aria-label="筛选" />)
    await userEvent.click(screen.getByRole('combobox', { name: '筛选' }))
    await userEvent.click(await screen.findByRole('option', { name: '全部状态' }))
    expect(onValueChange).toHaveBeenCalledWith('')
  })

  it('调用点的 className 覆盖门面尺寸，而不是与之并列冲突', () => {
    render(
      <Select
        value="draft"
        onValueChange={vi.fn()}
        options={OPTS}
        className="h-7 text-xs"
        aria-label="紧凑"
      />,
    )
    const cls = screen.getByRole('combobox', { name: '紧凑' }).className
    expect(cls).toContain('h-7')
    expect(cls).not.toContain('h-8')
  })
})
