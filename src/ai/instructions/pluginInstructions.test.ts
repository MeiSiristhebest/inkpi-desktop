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
      instructionVersion: '2',
      pluginId: 'reader-hook',
    })
    expect(task.input.payload).toMatchObject({
      pluginId: 'reader-hook',
      analysisInput: { chapter: '正文' },
      analysisContext: { revision: 4 },
    })
    expect(task.metadata).not.toHaveProperty('instruction')
  })

  it('projects HTML plugin input to canonical semantic text before task construction', () => {
    const task = createPluginAnalysisTask({
      pluginId: 'reader-hook',
      documentId: 'doc-html',
      input: '<h2>标题</h2><p>甲<strong>乙</strong><br>丙</p>',
    })

    expect(task.input).toMatchObject({
      text: '标题\n甲乙\n丙',
      documentId: 'doc-html',
      payload: {
        pluginId: 'reader-hook',
        analysisInput: '标题\n甲乙\n丙',
      },
    })
  })

  it('provides a lazy generic instruction for an extension id', () => {
    const definition = getPluginInstruction('extension-only')
    expect(definition).toEqual({
      id: 'plugin.extension-only.analysis',
      version: '1',
      systemInstruction: expect.stringContaining('structured plugin input'),
    })
  })

  it('keeps commercial and reader analysis separate from measured outcomes', () => {
    expect(getPluginInstruction('gold-chapters-eval').systemInstruction).toContain(
      'Do not predict publisher decisions, signing, subscriptions, readership, or sales.',
    )
    expect(getPluginInstruction('paywall-sentry').systemInstruction).toContain(
      'Do not predict retention, paid conversion, subscriptions, or revenue without supplied platform data.',
    )
    expect(getPluginInstruction('reader-simulator').systemInstruction).toContain(
      'not real reader feedback or measured retention, conversion, subscriptions, or sales.',
    )
  })

  it('tells Multi-Calendar to treat evenly sampled chapter gaps as unreviewed', () => {
    const instruction = getPluginInstruction('multi-calendar')

    expect(instruction.systemInstruction).toContain('When chapterSampling is evenly-spaced')
    expect(instruction.systemInstruction).toContain(
      'treat gaps between supplied chapters as unreviewed',
    )
  })

  it('versions the grounded opening contract and requires quotes, uncertainty, and genre flexibility', () => {
    const instruction = getPluginInstruction('gold-chapters-eval')
    expect(instruction.version).toBe('2')
    for (const requirement of [
      'Return JSON matching responseContract',
      'UTF-16',
      'negation',
      'missing context',
      'different genres',
      'Never generate quality scores',
    ]) {
      expect(instruction.systemInstruction).toContain(requirement)
    }
    const task = createPluginAnalysisTask({ pluginId: 'gold-chapters-eval', input: {} })
    expect(task.metadata?.instructionVersion).toBe('2')
  })
})
