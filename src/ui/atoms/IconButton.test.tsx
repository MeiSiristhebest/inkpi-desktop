import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IconButton } from './IconButton'

describe('IconButton atom', () => {
  afterEach(() => cleanup())

  it('renders with required aria-label for accessibility', () => {
    render(
      <IconButton label="返回作品库">
        <span>Icon</span>
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: '返回作品库' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', '返回作品库')
  })

  it('provides accessible hit target sizing', () => {
    render(
      <IconButton label="全屏">
        <span>Icon</span>
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: '全屏' })
    expect(btn.className).toContain('min-w-8')
    expect(btn.className).toContain('min-h-8')
  })

  it('wraps with Tooltip when tooltip is enabled', () => {
    render(
      <IconButton label="关闭" tooltip>
        <span>Icon</span>
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: '关闭' })
    expect(btn).toBeInTheDocument()
  })
})
