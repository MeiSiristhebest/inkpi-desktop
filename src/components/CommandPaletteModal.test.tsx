import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    const input = screen.getByPlaceholderText('搜索命令、视图、能力、插件或快捷操作…')
    fireEvent.change(input, { target: { value: '审计' } })

    expect(screen.queryByText('打开大屏')).not.toBeInTheDocument()
    expect(screen.getByText('启动连续性审计')).toBeInTheDocument()
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

    fireEvent.click(screen.getByTestId('command-palette-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
