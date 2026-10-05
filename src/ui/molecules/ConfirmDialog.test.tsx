import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(() => cleanup())

  it('renders a labelled dialog with working cancel and confirm', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open title="清空回收站" onConfirm={onConfirm} onCancel={onCancel}>
        <p>将永久移除 3 个作品。</p>
      </ConfirmDialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)).toHaveTextContent('清空回收站')

    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('names each mounted instance with its own title', () => {
    render(
      <>
        <ConfirmDialog open title="移出作品库" onConfirm={vi.fn()} onCancel={vi.fn()} />
        <ConfirmDialog open title="永久删除作品" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    )
    const ids = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'))
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
    expect(document.getElementById(ids[0]!)).toHaveTextContent('移出作品库')
    expect(document.getElementById(ids[1]!)).toHaveTextContent('永久删除作品')
  })
})
