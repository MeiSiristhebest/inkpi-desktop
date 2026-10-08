import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HelpTooltip } from './HelpTooltip'

describe('HelpTooltip molecule', () => {
  afterEach(() => cleanup())

  it('renders trigger button with aria-haspopup="dialog" and aria-expanded="false"', () => {
    render(<HelpTooltip title="字数统计规则">此处解释统计方式</HelpTooltip>)
    const trigger = screen.getByRole('button', { name: '字数统计规则' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens dialog on trigger click with aria-modal="true" and proper labelling', () => {
    render(<HelpTooltip title="字数统计规则">此处解释统计方式</HelpTooltip>)
    const trigger = screen.getByRole('button', { name: '字数统计规则' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const titleEl = screen.getByText('字数统计规则')
    expect(dialog).toHaveAttribute('aria-labelledby', titleEl.id)

    const descEl = screen.getByText('此处解释统计方式')
    expect(dialog).toHaveAttribute('aria-describedby', descEl.id)
  })

  it('closes on Escape key and restores focus to trigger', () => {
    render(<HelpTooltip title="字数统计规则">此处解释统计方式</HelpTooltip>)
    const trigger = screen.getByRole('button', { name: '字数统计规则' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})
