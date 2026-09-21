import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch, Slider, Segmented } from './SettingsShared'

describe('Switch primitive', () => {
  it('has role="switch" and aria-checked reflects state', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} ariaLabel="Enable feature" />)
    const btn = screen.getByRole('switch')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-checked', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Enable feature')
  })

  it('toggles checked via click', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles via click; keyboard activation uses native button behavior', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />)
    // Verify the button has correct ARIA
    const btn = screen.getByRole('switch')
    expect(btn).toHaveAttribute('aria-checked', 'false')
    // Click toggles (primary interaction path)
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders optional visible label next to the switch', () => {
    render(<Switch checked={false} onChange={vi.fn()} ariaLabel="Auto-save" label="自动保存" />)
    expect(screen.getByText('自动保存')).toBeInTheDocument()
  })
})

describe('Slider primitive', () => {
  it('passes aria-label and aria-valuetext to the native range input', () => {
    render(
      <Slider
        min={0}
        max={100}
        value={50}
        onChange={vi.fn()}
        ariaLabel="Volume"
        ariaValueText="50%"
      />,
    )
    const input = screen.getByLabelText('Volume')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-valuetext', '50%')
  })

  it('defaults aria-valuetext to the numeric value', () => {
    render(<Slider min={0} max={10} value={7} onChange={vi.fn()} ariaLabel="Brightness" />)
    const input = screen.getByLabelText('Brightness')
    expect(input).toHaveAttribute('aria-valuetext', '7')
  })

  it('calls onChange on input change', () => {
    const onChange = vi.fn()
    render(<Slider min={0} max={100} value={0} onChange={onChange} ariaLabel="Range" />)
    const input = screen.getByLabelText('Range')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith(42)
  })

  it('exposes correct aria attributes and responds to value changes', () => {
    const onChange = vi.fn()
    render(
      <Slider
        min={0}
        max={100}
        value={50}
        step={5}
        onChange={onChange}
        ariaLabel="Volume"
        ariaValueText="50%"
      />,
    )
    const input = screen.getByLabelText('Volume')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
    expect(input).toHaveAttribute('step', '5')
    expect(input).toHaveAttribute('value', '50')
    expect(input).toHaveAttribute('aria-valuetext', '50%')
    // Native change event works
    fireEvent.change(input, { target: { value: '75' } })
    expect(onChange).toHaveBeenCalledWith(75)
  })
})

describe('Segmented primitive', () => {
  it('has role="radiogroup" and options have role="radio"', () => {
    render(
      <Segmented
        value="a"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
        ]}
        onChange={vi.fn()}
        ariaLabel="Layout"
      />,
    )
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'Layout')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('sets aria-checked on the active radio option', () => {
    const { rerender } = render(
      <Segmented
        value="a"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
        ]}
        onChange={vi.fn()}
        ariaLabel="Layout"
      />,
    )
    const [radioA, radioB] = screen.getAllByRole('radio')
    expect(radioA).toHaveAttribute('aria-checked', 'true')
    expect(radioB).toHaveAttribute('aria-checked', 'false')

    rerender(
      <Segmented
        value="b"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
        ]}
        onChange={vi.fn()}
        ariaLabel="Layout"
      />,
    )
    expect(radioA).toHaveAttribute('aria-checked', 'false')
    expect(radioB).toHaveAttribute('aria-checked', 'true')
  })

  it('navigates with ArrowRight advancing through options', () => {
    // Test A → B
    const onChange1 = vi.fn()
    const { container: c1 } = render(
      <Segmented
        value="a"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
          { v: 'c', label: 'C' },
        ]}
        onChange={onChange1}
        ariaLabel="Nav"
      />,
    )
    const groupA = c1.querySelector('[role="radiogroup"]') as HTMLDivElement
    groupA?.focus()
    fireEvent.keyDown(groupA!, { key: 'ArrowRight' })
    expect(onChange1).toHaveBeenCalledWith('b')

    // Test B → C
    const onChange2 = vi.fn()
    const { container: c2 } = render(
      <Segmented
        value="b"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
          { v: 'c', label: 'C' },
        ]}
        onChange={onChange2}
        ariaLabel="Nav"
      />,
    )
    const groupB = c2.querySelector('[role="radiogroup"]') as HTMLDivElement
    groupB?.focus()
    fireEvent.keyDown(groupB!, { key: 'ArrowRight' })
    expect(onChange2).toHaveBeenCalledWith('c')

    // Test wrap C → A
    const onChange3 = vi.fn()
    const { container: c3 } = render(
      <Segmented
        value="c"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
          { v: 'c', label: 'C' },
        ]}
        onChange={onChange3}
        ariaLabel="Nav"
      />,
    )
    const groupC = c3.querySelector('[role="radiogroup"]') as HTMLDivElement
    groupC?.focus()
    fireEvent.keyDown(groupC!, { key: 'ArrowRight' })
    expect(onChange3).toHaveBeenCalledWith('a')
  })

  it('navigates with ArrowLeft going backward', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        value="a"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
          { v: 'c', label: 'C' },
        ]}
        onChange={onChange}
        ariaLabel="Nav"
      />,
    )
    const group = screen.getByRole('radiogroup')
    group.focus()

    // ArrowLeft from A wraps to C
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('Home and End navigate to first and last options', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        value="b"
        options={[
          { v: 'a', label: 'A' },
          { v: 'b', label: 'B' },
          { v: 'c', label: 'C' },
        ]}
        onChange={onChange}
        ariaLabel="Nav"
      />,
    )
    const group = screen.getByRole('radiogroup')
    group.focus()

    fireEvent.keyDown(group, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('a')

    fireEvent.keyDown(group, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
