import { describe, expect, it } from 'vitest'
import { listPluginInstructionDefinitions } from '../instructions/pluginInstructions'
import { FIRST_PARTY_PLUGIN_IDS } from './pluginCatalog'
import { PLUGIN_RUNTIME_CATALOG, type PluginRuntimeClass } from './pluginRuntimeCatalog'

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
})
