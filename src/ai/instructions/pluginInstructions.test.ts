import { describe, expect, it } from 'vitest'
import { getPluginInstruction, listPluginInstructionDefinitions } from './pluginInstructions'
import { createPluginAnalysisTask } from '../tasks/pluginTasks'

describe('plugin instruction definitions', () => {
  it('keeps plugin lookup and registry definitions aligned with task kinds', () => {
    const definitions = listPluginInstructionDefinitions()

    expect(definitions.length).toBeGreaterThan(0)
    for (const definition of definitions) {
      const pluginId = definition.id.replace(/^plugin\./, '').replace(/\.analysis$/, '')
      expect(getPluginInstruction(pluginId)).toEqual(definition)
    }
  })

  it('keeps stable instruction metadata separate from dynamic plugin input', () => {
    const task = createPluginAnalysisTask({
      pluginId: 'reader-hook',
      input: { chapter: '正文' },
      context: { revision: 4 },
    })

    expect(task.metadata).toMatchObject({
      instructionId: 'plugin.reader-hook.analysis',
      instructionVersion: '1',
      pluginId: 'reader-hook',
    })
    expect(task.input.payload).toMatchObject({
      pluginId: 'reader-hook',
      analysisInput: { chapter: '正文' },
      analysisContext: { revision: 4 },
    })
    expect(task.metadata).not.toHaveProperty('instruction')
  })

  it('provides a lazy generic instruction for an extension id', () => {
    const definition = getPluginInstruction('extension-only')
    expect(definition).toEqual({
      id: 'plugin.extension-only.analysis',
      version: '1',
      systemInstruction: expect.stringContaining('structured plugin input'),
    })
  })
})
