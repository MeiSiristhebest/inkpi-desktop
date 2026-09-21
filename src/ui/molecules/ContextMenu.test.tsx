import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

const makeItems = (count = 3): ContextMenuItem[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `item-${i}`,
    label: `Item ${i + 1}`,
    onClick: vi.fn(),
  }))

describe('ContextMenu primitive', () => {
  afterEach(() => cleanup())

  it('renders with role="menu"', () => {
    render(<ContextMenu items={makeItems()} onClose={vi.fn()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('items have role="menuitem"', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('focuses the first item on open', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<ContextMenu items={makeItems()} onClose={onClose} />)
    // Escape is handled at window level
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates with ArrowDown', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    // Fire on the container div which has onKeyDown
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
  })

  it('navigates with ArrowUp (wraps to end)', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Home moves to first item', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])

    fireEvent.keyDown(container, { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
  })

  it('End moves to last item', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Enter activates the focused item', () => {
    const items = makeItems(3)
    render(<ContextMenu items={items} onClose={vi.fn()} />)
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'Enter' })
    expect(items[1].onClick).toHaveBeenCalledTimes(1)
  })

  it('clicking an item calls its onClick and onClose', () => {
    const onClose = vi.fn()
    const items = makeItems(2)
    render(<ContextMenu items={items} onClose={onClose} />)
    const [first] = screen.getAllByRole('menuitem')
    fireEvent.click(first)
    expect(items[0].onClick).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape without activating any item', () => {
    const onClose = vi.fn()
    const items = makeItems(2)
    render(<ContextMenu items={items} onClose={onClose} />)
    // Escape handled at window level
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(items[0].onClick).not.toHaveBeenCalled()
    expect(items[1].onClick).not.toHaveBeenCalled()
  })
})
