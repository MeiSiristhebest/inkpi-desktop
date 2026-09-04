import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadEnabledPluginIds,
  loadEnabledPluginIdsFromIDB,
  saveEnabledPluginIds,
  ALL_AVAILABLE_PLUGINS,
  STORAGE_KEY_ENABLED_PLUGINS,
} from './pluginRegistry'

describe('pluginRegistry state persistence & defaults', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads default enabled plugins when storage is empty', () => {
    const ids = loadEnabledPluginIds()
    expect(ids.has('living-codex')).toBe(true)
  })

  it('persists and restores enabled plugin set accurately', () => {
    const custom = new Set(['living-codex', 'custom-plugin'])
    saveEnabledPluginIds(custom)

    const reloaded = loadEnabledPluginIds()
    expect(reloaded.has('living-codex')).toBe(true)
    expect(reloaded.has('custom-plugin')).toBe(true)
  })

  it('handles invalid json gracefully in storage', () => {
    localStorage.setItem(STORAGE_KEY_ENABLED_PLUGINS, 'invalid-json{')
    const ids = loadEnabledPluginIds()
    expect(ids.has('living-codex')).toBe(true)
  })

  it('contains registered plugins with complete metadata', () => {
    expect(ALL_AVAILABLE_PLUGINS.length).toBeGreaterThan(0)
    const codex = ALL_AVAILABLE_PLUGINS.find((p) => p.id === 'living-codex')
    expect(codex).toBeDefined()
    expect(codex?.version).toBe('1.0.0')
    expect(codex?.category).toBe('lore')
  })

  it('mirrors enabled state to IndexedDB and falls back when localStorage is cleared', async () => {
    const custom = new Set(['living-codex'])
    saveEnabledPluginIds(custom)
    // 模拟 Tauri WebView localStorage 被清空/不持久化
    localStorage.clear()
    expect(loadEnabledPluginIds().has('living-codex')).toBe(true) // 回到默认值

    const fromIDB = await loadEnabledPluginIdsFromIDB()
    expect(fromIDB).not.toBeNull()
    expect(fromIDB!.has('living-codex')).toBe(true)
  })
})

import { renderHook, act } from '@testing-library/react'
import { usePluginRegistry, PluginProvider } from './pluginRegistry'
import React from 'react'

describe('usePluginRegistry hook & Provider coverage', () => {
  it('toggles, enables, and disables plugins via Provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(PluginProvider, null, children)
    )
    const { result } = renderHook(() => usePluginRegistry(), { wrapper })
    expect(result.current.allPlugins.length).toBeGreaterThan(0)
    expect(result.current.isPluginEnabled('living-codex')).toBe(true)

    act(() => {
      result.current.disablePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(false)

    act(() => {
      result.current.enablePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(true)

    act(() => {
      result.current.togglePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(false)

    act(() => {
      result.current.enablePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(true)

    act(() => {
      result.current.disablePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(false)

    act(() => {
      result.current.togglePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(true)
  })
})

