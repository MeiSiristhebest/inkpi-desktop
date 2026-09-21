import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal primitive', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with role="dialog" and aria-modal="true"', () => {
    render(
      <Modal onClose={vi.fn()} title="Test Dialog">
        <p>Content</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })

  it('links aria-labelledby to the title element', () => {
    const { container } = render(
      <Modal onClose={vi.fn()} title="My Title">
        <p>Body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    // The sr-only span should exist in the document
    const titleEl = container.querySelector(`#${labelledBy}`)
    expect(titleEl).toBeInTheDocument()
    expect(titleEl?.textContent).toBe('My Title')
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}>Click me</Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab focus within the dialog', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} title="Focus trap">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    )
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
      <Modal onClose={vi.fn()} title="Dialog">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    )
    expect(document.activeElement).toHaveTextContent('First')
  })

  it('works without a title (no aria-labelledby)', () => {
    render(
      <Modal onClose={vi.fn()}>
        <p>No title dialog</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
  })

  it('closes when backdrop is clicked (default closeOnBackdrop=true)', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    )
    // Click the backdrop (outside the modal panel)
    fireEvent.click(document.querySelector('.fixed.inset-0')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when backdrop click is disabled', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} title="Test" closeOnBackdrop={false}>
        <p>Content</p>
      </Modal>,
    )
    fireEvent.click(document.querySelector('.fixed.inset-0')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
