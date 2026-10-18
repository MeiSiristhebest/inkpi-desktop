import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './molecules/Modal'
import { Popover } from './molecules/Popover'
import { ContextMenu } from './molecules/ContextMenu'

describe('overlay focus and dismissal contract', () => {
  it('closes only the top nested popover on the first Escape', async () => {
    const closeModal = vi.fn()
    render(
      <Modal title="Editor" onClose={closeModal}>
        <Popover trigger={<button>Open help</button>} title="Writing help">
          <button>Help action</button>
        </Popover>
      </Modal>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open help' }))
    expect(screen.getByRole('dialog', { name: 'Writing help' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Writing help' })).not.toBeInTheDocument(),
    )
    expect(closeModal).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeModal).toHaveBeenCalledTimes(1)
  })

  it('does not close a dialog for an Escape used by IME composition', () => {
    const closeModal = vi.fn()
    render(
      <Modal title="Editor" onClose={closeModal}>
        <button>Write</button>
      </Modal>,
    )

    fireEvent.keyDown(window, { key: 'Escape', isComposing: true })
    expect(closeModal).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeModal).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside a modal with no focusable controls', () => {
    render(
      <Modal title="Notice" onClose={vi.fn()}>
        <p>Nothing to focus here.</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Notice' })
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dialog)
  })

  it('includes links and editable prose in the focus loop', () => {
    render(
      <Modal title="Reference" onClose={vi.fn()}>
        <a href="#source">Open source</a>
        <div contentEditable="true" role="textbox" aria-label="Draft text" />
      </Modal>,
    )
    const link = screen.getByRole('link', { name: 'Open source' })
    const editor = screen.getByRole('textbox', { name: 'Draft text' })

    expect(document.activeElement).toBe(link)
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(editor)
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(link)
  })

  it('treats a context menu as the top Escape layer inside a dialog', async () => {
    const closeModal = vi.fn()
    const NestedMenu = () => {
      const [open, setOpen] = useState(false)
      return (
        <Modal title="Editor" onClose={closeModal}>
          <button onClick={() => setOpen(true)}>Open menu</button>
          {open && (
            <ContextMenu
              ariaLabel="Chapter menu"
              onClose={() => setOpen(false)}
              items={[{ key: 'rename', label: 'Rename', onClick: vi.fn() }]}
            />
          )}
        </Modal>
      )
    }
    render(<NestedMenu />)

    const menuTrigger = screen.getByRole('button', { name: 'Open menu' })
    menuTrigger.focus()
    fireEvent.click(menuTrigger)
    expect(screen.getByRole('menu', { name: 'Chapter menu' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: 'Chapter menu' })).not.toBeInTheDocument(),
    )
    expect(document.activeElement).toBe(menuTrigger)
    expect(closeModal).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeModal).toHaveBeenCalledTimes(1)
  })
})
