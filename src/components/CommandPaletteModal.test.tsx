import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPaletteModal } from './CommandPaletteModal'
import { commandRegistry, type Command } from '../core/commandRegistry'

describe('CommandPaletteModal Component', () => {
  const mockExec1 = vi.fn()
  const mockExec2 = vi.fn()

  const cmd1: Command = {
    id: 'cmd-test-1',
    title: '打开大屏',
    keywords: ['dashboard', '大屏'],
    category: 'view',
    execute: mockExec1,
  }

  const cmd2: Command = {
    id: 'cmd-test-2',
    title: '启动连续性审计',
    keywords: ['continuity', 'audit', '审计'],
    category: 'continuity',
    execute: mockExec2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    commandRegistry.register(cmd1)
    commandRegistry.register(cmd2)
  })

  it('renders commands and filters by search query', () => {
    render(<CommandPaletteModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('打开大屏')).toBeInTheDocument()
    expect(screen.getByText('启动连续性审计')).toBeInTheDocument()
    expect(screen.getByText('view')).toBeInTheDocument()
    expect(screen.getByText('continuity')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('搜索命令、视图、能力、插件或快捷操作…')
    fireEvent.change(input, { target: { value: '审计' } })

    expect(screen.queryByText('打开大屏')).not.toBeInTheDocument()
    expect(screen.getByText('启动连续性审计')).toBeInTheDocument()
  })

  it('exposes dialog/listbox semantics and focuses the search field', () => {
    render(<CommandPaletteModal isOpen={true} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // 名称由 Modal 的 title 提供（sr-only span + aria-labelledby），面板自己不再写 aria-label
    expect(dialog).toHaveAccessibleName('命令面板')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', '命令候选列表')
    expect(screen.getByRole('textbox', { name: '搜索命令' })).toHaveFocus()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('handles keyboard navigation and execution on Enter', () => {
    const onClose = vi.fn()
    render(<CommandPaletteModal isOpen={true} onClose={onClose} />)

    // 默认选中第一个
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(mockExec1).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape or clicking backdrop', () => {
    const onClose = vi.fn()
    render(<CommandPaletteModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()

    // 遮罩现在是 Modal 自己的 overlay；点面板内部不应多关掉一次
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('listbox'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('关闭后把焦点还给打开前的控件（§P4.1：契约由 Modal 提供）', () => {
    const Host = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            打开命令面板
          </button>
          {open && <CommandPaletteModal isOpen onClose={() => setOpen(false)} />}
        </>
      )
    }
    render(<Host />)

    const trigger = screen.getByRole('button', { name: '打开命令面板' })
    trigger.focus()
    fireEvent.click(trigger)
    // 面板挂载时触发按钮是 document.activeElement，契约却必须先把焦点交给搜索框，
    // 卸载时再还回去 —— 少了任何一步，键盘用户就会被丢在页面里。
    expect(screen.getByRole('textbox', { name: '搜索命令' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })
})
