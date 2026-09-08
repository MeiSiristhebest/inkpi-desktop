import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'
import { PluginProvider, usePluginRegistry } from '../../core/pluginRegistry'
import { listPluginInstructionDefinitions } from '../instructions/pluginInstructions'
import { FIRST_PARTY_PLUGIN_IDS } from './pluginCatalog'
import { getPluginRuntimeEntry, PLUGIN_RUNTIME_CATALOG, type PluginRuntimeClass } from './pluginRuntimeCatalog'
import { createPluginAnalysisTask } from './pluginTasks'

describe('plugin runtime catalog', () => {
  it('covers every first-party plugin exactly once', () => {
    const ids = Object.keys(PLUGIN_RUNTIME_CATALOG)
    expect(ids).toHaveLength(FIRST_PARTY_PLUGIN_IDS.length)
    expect(new Set(ids)).toEqual(new Set(FIRST_PARTY_PLUGIN_IDS))

    for (const pluginId of FIRST_PARTY_PLUGIN_IDS) {
      expect(PLUGIN_RUNTIME_CATALOG[pluginId].pluginId).toBe(pluginId)
    }
  })

  it('keeps the seven plan classes explicit', () => {
    const allowed: PluginRuntimeClass[] = [
      'pure-local',
      'ai-task',
      'context-provider',
      'tool',
      'workflow',
      'ui-only',
      'hybrid',
    ]
    for (const entry of Object.values(PLUGIN_RUNTIME_CATALOG)) {
      expect(allowed).toContain(entry.runtimeClass)
      expect(entry.runtimeTarget).toBeTruthy()
    }
  })

  it('maps every registered plugin instruction to a task-runtime boundary', () => {
    const definitions = listPluginInstructionDefinitions()
    const taskEntries = new Map(
      Object.values(PLUGIN_RUNTIME_CATALOG)
        .filter((entry) => entry.taskKind)
        .map((entry) => [entry.taskKind, entry]),
    )

    expect(definitions).toHaveLength(22)
    for (const definition of definitions) {
      expect(taskEntries.has(definition.taskKind ?? definition.id)).toBe(true)
    }
  })

  it('uses metadata-first plugin task instructions and preserves extension lazy fallback', () => {
    const firstParty = createPluginAnalysisTask({ pluginId: 'narrative-linter', input: 'text' })
    const extension = createPluginAnalysisTask({ pluginId: 'external-plugin', input: 'text' })

    expect(firstParty.metadata).toMatchObject({
      pluginId: 'narrative-linter',
      pluginCatalog: 'first-party-v1',
      instructionId: 'plugin.narrative-linter.analysis',
      instructionVersion: '1',
    })
    expect(firstParty.metadata).not.toHaveProperty('instruction')
    expect(extension.metadata).toMatchObject({
      pluginId: 'external-plugin',
      pluginCatalog: 'extension',
      instruction: expect.any(String),
    })
  })

  it('returns no runtime entry for unknown ids and keeps catalog ids unique', () => {
    expect(getPluginRuntimeEntry('missing-plugin')).toBeUndefined()
    expect(new Set(Object.keys(PLUGIN_RUNTIME_CATALOG)).size).toBe(Object.keys(PLUGIN_RUNTIME_CATALOG).length)
  })

  it('does not duplicate a plugin when activation is repeated', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(PluginProvider, null, children)
    const { result } = renderHook(() => usePluginRegistry(), { wrapper })

    act(() => {
      result.current.disablePlugin('living-codex')
      result.current.enablePlugin('living-codex')
      result.current.enablePlugin('living-codex')
    })

    expect(result.current.activePlugins.filter((plugin) => plugin.id === 'living-codex')).toHaveLength(1)
    expect(result.current.enabledIds.has('living-codex')).toBe(true)
  })
})
