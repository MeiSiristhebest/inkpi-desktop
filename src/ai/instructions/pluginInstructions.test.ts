import { describe, expect, it } from 'vitest'
import { getPluginInstruction, listPluginInstructionDefinitions } from './pluginInstructions'

describe('plugin instruction definitions', () => {
  it('keeps plugin lookup and registry definitions aligned with task kinds', () => {
    const definitions = listPluginInstructionDefinitions()

    expect(definitions.length).toBeGreaterThan(0)
    for (const definition of definitions) {
      const pluginId = definition.id.replace(/^plugin\./, '').replace(/\.analysis$/, '')
      expect(getPluginInstruction(pluginId)).toEqual(definition)
    }
  })
})
