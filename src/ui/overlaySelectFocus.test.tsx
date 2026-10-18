import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './molecules/Modal'
import { Select } from './primitives/select'

describe('modal focus with portaled Select', () => {
  it('moves Tab from the open Select to the next dialog control', async () => {
    const user = userEvent.setup()
    render(
      <Modal title="Chapter settings" onClose={vi.fn()}>
        <Select
          aria-label="Chapter status"
          value="draft"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'review', label: 'Review' },
          ]}
          onValueChange={vi.fn()}
        />
        <button type="button">Save settings</button>
      </Modal>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Chapter status' })
    const nextControl = screen.getByRole('button', { name: 'Save settings' })
    await user.click(trigger)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{ArrowDown}')
    await user.tab()

    expect(document.activeElement).toBe(nextControl)
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('moves Shift+Tab from the open Select to the previous dialog control', async () => {
    const user = userEvent.setup()
    render(
      <Modal title="Chapter settings" onClose={vi.fn()}>
        <button type="button">Previous setting</button>
        <Select
          aria-label="Chapter status"
          value="draft"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'review', label: 'Review' },
          ]}
          onValueChange={vi.fn()}
        />
        <button type="button">Save settings</button>
      </Modal>,
    )

    const previousControl = screen.getByRole('button', { name: 'Previous setting' })
    const trigger = screen.getByRole('combobox', { name: 'Chapter status' })
    await user.click(trigger)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}')
    await user.tab({ shift: true })

    expect(document.activeElement).toBe(previousControl)
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('returns focus to the Select trigger after Escape without closing the modal', async () => {
    const user = userEvent.setup()
    render(
      <Modal title="Chapter settings" onClose={vi.fn()}>
        <Select
          aria-label="Chapter status"
          value="draft"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'review', label: 'Review' },
          ]}
          onValueChange={vi.fn()}
        />
      </Modal>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Chapter status' })
    await user.click(trigger)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Chapter settings' })).toBeInTheDocument()
  })

  it('keeps focus on the trigger after keyboard selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Modal title="Chapter settings" onClose={vi.fn()}>
        <Select
          aria-label="Chapter status"
          value="draft"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'review', label: 'Review' },
          ]}
          onValueChange={onValueChange}
        />
      </Modal>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Chapter status' })
    await user.click(trigger)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onValueChange).toHaveBeenCalledWith('review')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})
