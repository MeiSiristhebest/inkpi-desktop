import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizableWidth } from './useResizableWidth'

describe('useResizableWidth hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes with default width when no saved width exists', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 240,
        minWidth: 180,
        maxWidth: 360,
      }),
    )
    expect(result.current.width).toBe(240)
    expect(result.current.isDragging).toBe(false)
  })

  it('clamps saved width within min and max constraints', () => {
    localStorage.setItem('test-resizable-width', '100') // Below min 180
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 240,
        minWidth: 180,
        maxWidth: 360,
        storageKey: 'test-resizable-width',
      }),
    )
    // When saved is below min, falls back to initialWidth
    expect(result.current.width).toBe(240)
  })

  it('loads valid saved width from storage', () => {
    localStorage.setItem('test-resizable-valid', '300')
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 240,
        minWidth: 180,
        maxWidth: 360,
        storageKey: 'test-resizable-valid',
      }),
    )
    expect(result.current.width).toBe(300)
  })

  it('handles mouse drag to adjust width and respects boundaries', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 240,
        minWidth: 180,
        maxWidth: 360,
        storageKey: 'test-resizable-drag',
        direction: 'left',
      }),
    )

    // Simulate mouse down
    act(() => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 240,
      } as unknown as React.MouseEvent
      result.current.onMouseDown(mockEvent)
    })

    expect(result.current.isDragging).toBe(true)

    // Simulate drag to right (+50px)
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 290 })
      document.dispatchEvent(moveEvent)
    })

    expect(result.current.width).toBe(290)

    // Simulate drag past max width (e.g. +300px)
    act(() => {
      const movePastMax = new MouseEvent('mousemove', { clientX: 600 })
      document.dispatchEvent(movePastMax)
    })

    expect(result.current.width).toBe(360) // Clamped at max

    // Simulate drag past min width
    act(() => {
      const movePastMin = new MouseEvent('mousemove', { clientX: 50 })
      document.dispatchEvent(movePastMin)
    })

    expect(result.current.width).toBe(180) // Clamped at min

    // Simulate mouse up
    act(() => {
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('supports right-anchored direction (dragging left border expands to the left)', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 320,
        minWidth: 260,
        maxWidth: 500,
        direction: 'right',
      }),
    )

    act(() => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 800,
      } as unknown as React.MouseEvent
      result.current.onMouseDown(mockEvent)
    })

    // Drag left by 40px (clientX = 760) -> expands right panel by 40px
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 760 })
      document.dispatchEvent(moveEvent)
    })

    expect(result.current.width).toBe(360)

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })
  })

  it('resets to initial width on resetWidth', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        initialWidth: 240,
        minWidth: 180,
        maxWidth: 360,
        storageKey: 'test-resizable-reset',
      }),
    )

    act(() => {
      result.current.resetWidth()
    })

    expect(result.current.width).toBe(240)
  })
})
