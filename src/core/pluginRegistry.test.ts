import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { indexedDbSettingsKVRepository } from '../adapters/indexedDbSettingsKVRepository'
import {
  loadEnabledPluginIds,
  loadEnabledPluginIdsFromIDB,
  saveEnabledPluginIds,
  ALL_AVAILABLE_PLUGINS,
  CANONICAL_PLUGIN_KEY,
  PluginProvider,
  STORAGE_KEY_ENABLED_PLUGINS,
  usePluginRegistry,
} from './pluginRegistry'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('pluginRegistry state persistence & defaults', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(async () => {
    localStorage.clear()
    await indexedDbSettingsKVRepository.remove('__global__', 'enabledPlugins')
  })

  it('loads default enabled plugins when storage is empty (clean minimal default)', () => {
    const ids = loadEnabledPluginIds()
    // 纯粹模式默认全关：不污染用户左侧导航栏
    expect(ids.size).toBe(0)
  })

  it('does not use stale localStorage as the first-paint authority', () => {
    localStorage.setItem(STORAGE_KEY_ENABLED_PLUGINS, JSON.stringify(['legacy-plugin']))

    expect(loadEnabledPluginIds().has('legacy-plugin')).toBe(false)
  })

  it('persists and restores enabled plugin set accurately', async () => {
    const custom = new Set(['living-codex', 'custom-plugin'])
    await saveEnabledPluginIds(custom)

    const reloaded = await loadEnabledPluginIdsFromIDB()
    expect(reloaded?.has('living-codex')).toBe(true)
    expect(reloaded?.has('custom-plugin')).toBe(true)
  })

  it('handles invalid json gracefully in storage', () => {
    localStorage.setItem(STORAGE_KEY_ENABLED_PLUGINS, 'invalid-json{')
    const ids = loadEnabledPluginIds()
    expect(ids.size).toBe(0)
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
    await saveEnabledPluginIds(custom)
    // 模拟 Tauri WebView localStorage 被清空/不持久化
    localStorage.clear()
    expect(loadEnabledPluginIds().size).toBe(0) // 回到默认值（纯粹模式下为 0）

    const fromIDB = await loadEnabledPluginIdsFromIDB()
    expect(fromIDB).not.toBeNull()
    expect(fromIDB!.has('living-codex')).toBe(true)
  })

  it('prefers canonical IndexedDB state and removes stale migration keys', async () => {
    const projectId = 'plugin-authority-project'
    const canonicalIds = new Set(['living-codex'])
    await saveEnabledPluginIds(canonicalIds, projectId)
    localStorage.setItem(`inkpi_enabled_plugins_${projectId}`, JSON.stringify(['timeline-grid']))
    localStorage.setItem(STORAGE_KEY_ENABLED_PLUGINS, JSON.stringify(['timeline-grid']))

    await expect(loadEnabledPluginIdsFromIDB(projectId)).resolves.toEqual(canonicalIds)
    expect(localStorage.getItem(`inkpi_enabled_plugins_${projectId}`)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY_ENABLED_PLUGINS)).toBeNull()
  })
})

describe('usePluginRegistry hook & Provider coverage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('toggles, enables, and disables plugins via Provider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(PluginProvider, null, children)
    const { result } = renderHook(() => usePluginRegistry(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.allPlugins.length).toBeGreaterThan(0)
    expect(result.current.isPluginEnabled('living-codex')).toBe(false)

    await act(async () => {
      await result.current.enablePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(true)

    await act(async () => {
      await result.current.disablePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(false)

    await act(async () => {
      await result.current.togglePlugin('living-codex')
    })
    expect(result.current.isPluginEnabled('living-codex')).toBe(true)

    await act(async () => {
      await result.current.enablePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(true)

    await act(async () => {
      await result.current.disablePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(false)

    await act(async () => {
      await result.current.togglePlugin('custom-test-plugin')
    })
    expect(result.current.isPluginEnabled('custom-test-plugin')).toBe(true)
  })

  it('does not let a delayed previous workspace load replace the selected workspace', async () => {
    const delayedWorkspace = deferred<unknown>()
    vi.spyOn(indexedDbSettingsKVRepository, 'get').mockImplementation(
      async <T>(scope: string, key: string, defaultValue: T): Promise<T> => {
        if (key !== CANONICAL_PLUGIN_KEY) return defaultValue
        if (scope === 'workspace-a') return (await delayedWorkspace.promise) as T
        if (scope === 'workspace-b') return ['living-codex'] as T
        return defaultValue
      },
    )
    let current: ReturnType<typeof usePluginRegistry> | undefined
    const Probe = () => {
      current = usePluginRegistry()
      return null
    }
    const treeFor = (workspaceId: string) =>
      React.createElement(PluginProvider, { workspaceId }, React.createElement(Probe))
    const view = render(treeFor('workspace-a'))
    await waitFor(() =>
      expect(indexedDbSettingsKVRepository.get).toHaveBeenCalledWith(
        'workspace-a',
        CANONICAL_PLUGIN_KEY,
        null,
      ),
    )
    view.rerender(treeFor('workspace-b'))
    await waitFor(() => expect(current?.isLoading).toBe(false))
    expect(current?.enabledIds.has('living-codex')).toBe(true)

    await act(async () => {
      delayedWorkspace.resolve(['timeline-grid'])
      await delayedWorkspace.promise
    })

    expect(current?.workspaceId).toBe('workspace-b')
    expect(current?.enabledIds.has('living-codex')).toBe(true)
    expect(current?.enabledIds.has('timeline-grid')).toBe(false)
  })

  it('waits for initial settings and merges a requested toggle into the loaded set', async () => {
    const delayedSettings = deferred<unknown>()
    vi.spyOn(indexedDbSettingsKVRepository, 'get').mockImplementation(
      async <T>(_scope: string, key: string, defaultValue: T): Promise<T> => {
        if (key !== CANONICAL_PLUGIN_KEY) return defaultValue
        return (await delayedSettings.promise) as T
      },
    )
    const persist = vi.spyOn(indexedDbSettingsKVRepository, 'set').mockResolvedValue(undefined)
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(PluginProvider, { workspaceId: 'slow-workspace' }, children)
    const { result } = renderHook(() => usePluginRegistry(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    let toggle: Promise<void> | undefined
    await act(async () => {
      toggle = result.current.togglePlugin('living-codex')
      await Promise.resolve()
    })
    expect(result.current.enabledIds.has('living-codex')).toBe(false)
    expect(persist).not.toHaveBeenCalled()

    await act(async () => {
      delayedSettings.resolve(['timeline-grid'])
      await toggle
    })

    expect(result.current.enabledIds.has('timeline-grid')).toBe(true)
    expect(result.current.enabledIds.has('living-codex')).toBe(true)
    expect(persist).toHaveBeenCalledWith(
      'slow-workspace',
      CANONICAL_PLUGIN_KEY,
      expect.arrayContaining(['timeline-grid', 'living-codex']),
    )
  })

  it('serializes quick enable and disable requests for the same workspace', async () => {
    const workspaceId = `serialized-workspace-${Math.random().toString(36).slice(2)}`
    localStorage.clear()
    await indexedDbSettingsKVRepository.remove(workspaceId, CANONICAL_PLUGIN_KEY)
    expect(localStorage.getItem(STORAGE_KEY_ENABLED_PLUGINS)).toBeNull()
    await expect(
      indexedDbSettingsKVRepository.get(workspaceId, CANONICAL_PLUGIN_KEY, null),
    ).resolves.toBeNull()
    const firstWriteStarted = deferred<void>()
    const finishFirstWrite = deferred<void>()
    const writeSnapshots: string[][] = []
    const writeThrough = indexedDbSettingsKVRepository.set.bind(indexedDbSettingsKVRepository) as (
      scope: string,
      key: string,
      value: unknown,
    ) => Promise<void>
    const persist = vi
      .spyOn(indexedDbSettingsKVRepository, 'set')
      .mockImplementation(async <T>(scope: string, key: string, value: T) => {
        if (scope === workspaceId && key === CANONICAL_PLUGIN_KEY) {
          writeSnapshots.push([...(value as string[])])
          if (writeSnapshots.length === 1) {
            firstWriteStarted.resolve()
            await finishFirstWrite.promise
          }
        }
        await writeThrough(scope, key, value)
      })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(PluginProvider, { workspaceId }, children)
    const { result } = renderHook(() => usePluginRegistry(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.enabledIds.size).toBe(0)

    let enable: Promise<void> | undefined
    let disable: Promise<void> | undefined
    await act(async () => {
      enable = result.current.enablePlugin('living-codex')
      disable = result.current.disablePlugin('living-codex')
    })
    await firstWriteStarted.promise

    expect(writeSnapshots).toEqual([['living-codex']])
    expect(result.current.enabledIds.has('living-codex')).toBe(false)

    await act(async () => {
      finishFirstWrite.resolve()
      await Promise.all([enable, disable])
    })

    expect(writeSnapshots).toEqual([['living-codex'], []])
    expect(result.current.enabledIds.has('living-codex')).toBe(false)
    await expect(
      indexedDbSettingsKVRepository.get<string[]>(workspaceId, CANONICAL_PLUGIN_KEY, []),
    ).resolves.not.toContain('living-codex')
  })
})
