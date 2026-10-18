import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarNav } from './SidebarNav'

describe('SidebarNav', () => {
  it('exposes the return-to-library action when a callback is available', () => {
    const onBackToHome = vi.fn()

    render(
      <SidebarNav
        activeTabId="editor"
        onSelectTab={vi.fn()}
        projectName="Viewport QA"
        onBackToHome={onBackToHome}
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '返回作品库' }))

    expect(onBackToHome).toHaveBeenCalledOnce()
  })
})
