// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const setTheme = vi.fn()
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setTheme }),
}))

let settings = { themeMode: 'system', themeSkin: 'default', uiFontSize: 13 }
vi.mock('./settings', () => ({
  useSettings: () => [
    settings,
    (patch: Partial<typeof settings>) => (settings = { ...settings, ...patch }),
  ],
}))

/** jsdom 没有 matchMedia，自己补一个能派事件的最小实现。 */
function installMediaQuery(initialDark: boolean) {
  const listeners = new Set<() => void>()
  const mq = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => mq)
  return {
    flip: (dark: boolean) => {
      mq.matches = dark
      act(() => {
        listeners.forEach((fn) => fn())
      })
    },
  }
}

async function mountController() {
  const { ThemeController } = await import('./ThemeController')
  return render(<ThemeController />)
}

/** 只在类型层面打开这个探测位，避免测试里到处 cast。 */
const w = window as unknown as Record<string, unknown>

describe('ThemeController · 原生窗口主题', () => {
  beforeEach(() => {
    setTheme.mockClear()
    settings = { themeMode: 'system', themeSkin: 'default', uiFontSize: 13 }
    w.__TAURI_INTERNALS__ = {}
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-skin')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete w.__TAURI_INTERNALS__
  })

  it('显式深色：标题栏跟着变深', async () => {
    installMediaQuery(false)
    settings = { ...settings, themeMode: 'dark' }
    await mountController()
    await waitFor(() => expect(setTheme).toHaveBeenCalledWith('dark'))
  })

  it('system 模式下系统翻转：皮肤与标题栏同时跟上，不用等设置改动', async () => {
    const media = installMediaQuery(false)
    await mountController()
    await waitFor(() => expect(setTheme).toHaveBeenCalledWith('light'))
    expect(document.documentElement.getAttribute('data-skin')).toBe('default')

    media.flip(true)
    await waitFor(() => expect(setTheme).toHaveBeenLastCalledWith('dark'))
    expect(document.documentElement.getAttribute('data-skin')).toBe('dark')
  })

  it('浏览器/jsdom 里没有原生桥，不抛错', async () => {
    installMediaQuery(true)
    delete w.__TAURI_INTERNALS__
    await mountController()
    expect(setTheme).not.toHaveBeenCalled()
    expect(document.documentElement.getAttribute('data-skin')).toBe('dark')
  })
})
