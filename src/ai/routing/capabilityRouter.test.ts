import { describe, expect, it } from 'vitest'
import { CapabilityRouter, NoCapableRouteError } from './index'

describe('capability-aware routing', () => {
  it('selects the highest-priority route satisfying every requirement', () => {
    const router = new CapabilityRouter([
      { id: 'offline', capabilities: ['creative-writing'], online: false, priority: 10 },
      { id: 'cloud', capabilities: ['creative-writing', 'continuity-audit'], online: true, priority: 5 },
    ])
    const selected = router.select({
      id: 'task',
      kind: 'creative.continuity.audit',
      input: {},
      requirements: { capabilities: ['creative-writing', 'continuity-audit'], network: 'required' },
    })
    expect(selected.route.id).toBe('cloud')
    expect(selected.matchedCapabilities).toEqual(['creative-writing', 'continuity-audit'])
  })

  it('fails explicitly when a required capability is unavailable', () => {
    const router = new CapabilityRouter([{ id: 'local', capabilities: ['text'], online: true }])
    expect(() =>
      router.select({
        id: 'task',
        kind: 'creative.deep.reasoning',
        input: {},
        requirements: { capabilities: ['reasoning'] },
      }),
    ).toThrow(NoCapableRouteError)
  })

  it('filters model capabilities before ranking routes', () => {
    const router = new CapabilityRouter([
      {
        id: 'small',
        capabilities: ['creative-reasoning'],
        online: true,
        priority: 100,
        modelCapabilities: {
          streaming: true,
          toolCalling: false,
          structuredOutput: true,
          jsonSchema: true,
          reasoning: false,
          promptCaching: false,
          maxContextTokens: 4096,
          maxOutputTokens: 1024,
        },
      },
      {
        id: 'reasoning',
        capabilities: ['creative-reasoning'],
        online: true,
        priority: 1,
        modelCapabilities: {
          streaming: true,
          toolCalling: true,
          structuredOutput: true,
          jsonSchema: true,
          reasoning: true,
          promptCaching: true,
          maxContextTokens: 32000,
          maxOutputTokens: 4096,
        },
      },
    ])
    expect(
      router.select({
        id: 'reasoning-task',
        kind: 'narrative.deep.reason',
        input: {},
        executionPolicy: { strategy: 'reasoning' },
        requirements: { capabilities: ['creative-reasoning'], minContextTokens: 8000 },
      }).route.id,
    ).toBe('reasoning')
  })

  it('selects an explicitly offline-capable model for offline tasks', () => {
    const router = new CapabilityRouter([
      {
        id: 'offline-model',
        capabilities: ['creative-writing'],
        online: false,
        priority: 1,
        modelCapabilities: {
          streaming: true,
          toolCalling: false,
          structuredOutput: false,
          jsonSchema: false,
          reasoning: false,
          promptCaching: false,
          offline: true,
          maxContextTokens: 4096,
          maxOutputTokens: 1024,
        },
      },
      {
        id: 'cloud-model',
        capabilities: ['creative-writing'],
        online: true,
        priority: 100,
        modelCapabilities: {
          streaming: true,
          toolCalling: false,
          structuredOutput: false,
          jsonSchema: false,
          reasoning: false,
          promptCaching: false,
          maxContextTokens: 4096,
          maxOutputTokens: 1024,
        },
      },
    ])

    expect(
      router.select({
        id: 'offline-task',
        kind: 'creative.continue',
        input: {},
        requirements: { capabilities: ['creative-writing'], network: 'offline' },
      }).route.id,
    ).toBe('offline-model')
  })

  it('fails when the only offline route cannot serve the requested model capability', () => {
    const router = new CapabilityRouter([
      {
        id: 'offline-text-only',
        capabilities: ['creative-writing'],
        online: false,
        modelCapabilities: {
          streaming: false,
          toolCalling: false,
          structuredOutput: false,
          jsonSchema: false,
          reasoning: false,
          promptCaching: false,
          offline: true,
          maxContextTokens: 4096,
          maxOutputTokens: 1024,
        },
      },
    ])

    expect(() =>
      router.select({
        id: 'offline-streaming-task',
        kind: 'creative.continue',
        input: {},
        requirements: {
          capabilities: ['creative-writing'],
          network: 'offline',
          streaming: true,
        },
      }),
    ).toThrow(NoCapableRouteError)
  })
})
