import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingWordCountWidget } from './FloatingWordCountWidget'
import { STORAGE_KEY_WIDGET_POS, getInitialWidgetPosition } from './floatingWordCountWidgetPosition'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { WordCountConfig } from '../modals/WordCountPanelModal'
import type { WritingSessionStats } from '../hooks/useWritingSessionStats'

const mockStats: WritingSessionStats = {
  sessionWords: 1500,
  speedPerHour: 1200,
  writingSeconds: 4500,
  idleSeconds: 300,
  todayTotalWords: 3500,
  speedHistory: [],
}

const mockConfig: WordCountConfig = {
  headerType: 'mascot',
  showMascotMotto: true,
  showSessionWords: true,
  showSpeed: true,
  showWritingTime: true,
  showIdleTime: true,
  layout: 'layout2',
}

describe('FloatingWordCountWidget layout and position persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads saved position from localStorage when valid', () => {
    localStorageKeyValueStore.set(STORAGE_KEY_WIDGET_POS, JSON.stringify({ x: 250, y: 180 }))
    const pos = getInitialWidgetPosition()
    expect(pos).toEqual({ x: 250, y: 180 })
  })

  it('falls back to default bottom-right position when no saved position exists', () => {
    const pos = getInitialWidgetPosition()
    expect(pos.x).toBeGreaterThanOrEqual(20)
    expect(pos.y).toBeGreaterThanOrEqual(40)
  })

  it('clamps saved position within screen bounds', () => {
    localStorageKeyValueStore.set(STORAGE_KEY_WIDGET_POS, JSON.stringify({ x: -100, y: 99999 }))
    const pos = getInitialWidgetPosition()
    expect(pos.x).toBe(10)
    expect(pos.y).toBeLessThan(99999)
  })

  it('saves new position on drag mouseup', () => {
    const setSpy = vi.spyOn(localStorageKeyValueStore, 'set')
    render(
      <FloatingWordCountWidget
        stats={mockStats}
        config={mockConfig}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const titleBar = screen.getByText('作家助手').closest('div')
    expect(titleBar).toBeTruthy()

    // 触发 mousedown 和 mousemove 模拟拖拽
    fireEvent.mouseDown(titleBar!, { clientX: 300, clientY: 300, button: 0 })
    fireEvent.mouseMove(window, { clientX: 350, clientY: 370 })
    fireEvent.mouseUp(window)

    expect(setSpy).toHaveBeenCalledWith(STORAGE_KEY_WIDGET_POS, expect.stringContaining('"x":'))
  })

  it('provides quick layout switching and calls onConfigChange', () => {
    const onConfigChange = vi.fn()
    render(
      <FloatingWordCountWidget
        stats={mockStats}
        config={mockConfig}
        onOpenSettings={vi.fn()}
        onConfigChange={onConfigChange}
        onClose={vi.fn()}
      />,
    )

    // 打开菜单
    const menuButton = screen.getByTitle('设置')
    fireEvent.click(menuButton)

    // 确认菜单中出现“切换排版”及 布局1、布局2、布局3 按钮
    expect(screen.getByText('切换排版')).toBeTruthy()
    const layout1Button = screen.getByText('布局1')
    expect(layout1Button).toBeTruthy()

    fireEvent.click(layout1Button)
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ layout: 'layout1' }))
  })
})
