import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Popover } from './Popover'

describe('Popover primitive', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders trigger and opens on click', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test Popover">
        <p>Content</p>
      </Popover>,
    )
    // The cloned trigger button should be in the document
    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger).toBeInTheDocument()
    // Panel should not be visible yet
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Click trigger to open
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders with role="dialog" and aria-modal="true"', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('links aria-labelledby to the title element', () => {
    const { container } = render(
      <Popover trigger={<button type="button">Open</button>} title="My Popover Title">
        <p>Body</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const titleEl = container.querySelector(`#${labelledBy}`)
    expect(titleEl).toBeInTheDocument()
    expect(titleEl?.textContent).toBe('My Popover Title')
  })

  it('links aria-describedby when description is provided', () => {
    render(
      <Popover
        trigger={<button type="button">Open</button>}
        title="Title"
        description="This is a description"
      >
        <p>Body</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const descEl = document.getElementById(describedBy!)
    expect(descEl).toBeInTheDocument()
    expect(descEl?.textContent).toBe('This is a description')
  })

  it('does not set aria-labelledby when no title is provided', () => {
    render(
      <Popover trigger={<button type="button">Open</button>}>
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
  })

  it('does not set aria-describedby when no description is provided', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Title">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveAttribute('aria-describedby')
  })

  it('closes on Escape key', async () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('traps Tab focus within the popover panel', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Focus trap">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)

    // Focus should start on first focusable
    expect(document.activeElement).toHaveTextContent('First')

    // Tab cycles: First → Second → First
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toHaveTextContent('Second')
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toHaveTextContent('First')
  })

  it('focuses the first focusable element on open', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Dialog">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    expect(document.activeElement).toHaveTextContent('First')
  })

  it('closes when backdrop is clicked (default closeOnBackdrop=true)', async () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    // Click the backdrop (the fixed overlay)
    const backdrop = document.querySelector('.fixed.inset-0.z-40') as HTMLElement
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not close when backdrop click is disabled', async () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test" closeOnBackdrop={false}>
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const backdrop = document.querySelector('.fixed.inset-0.z-40') as HTMLElement
    fireEvent.click(backdrop!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sets aria-expanded on the trigger', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('sets aria-haspopup="dialog" on the trigger', () => {
    render(
      <Popover trigger={<button type="button">Open</button>} title="Test">
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('renders description in the panel header', () => {
    render(
      <Popover
        trigger={<button type="button">Open</button>}
        title="Title"
        description="Helper text for the popover"
      >
        <p>Body content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    expect(screen.getByText('Helper text for the popover')).toBeInTheDocument()
  })

  it('does not duplicate click handlers when trigger already has onClick', () => {
    const onTriggerClick = vi.fn()
    render(
      <Popover
        trigger={
          <button type="button" onClick={onTriggerClick}>
            Open
          </button>
        }
        title="Test"
      >
        <p>Content</p>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    // Original onClick should be called
    expect(onTriggerClick).toHaveBeenCalledTimes(1)
    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
